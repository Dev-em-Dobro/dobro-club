import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { query } from "@/lib/db";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { createLive, type LiveInput } from "@/lib/lives";
import { signSession } from "@/lib/auth/session";
import { GET } from "@/app/api/evento/lives/route";
import { POST } from "@/app/api/evento/lives/[id]/abrir/route";

const MIN = 60 * 1000;
const at = (offsetMin: number) => new Date(Date.now() + offsetMin * MIN).toISOString();

function get(session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  return GET(new NextRequest("http://localhost/api/evento/lives", { headers }));
}

function abrir(id: string, session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  const req = new NextRequest(`http://localhost/api/evento/lives/${id}/abrir`, {
    method: "POST",
    headers,
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

async function lead(answered: boolean, email = "a@x.com") {
  const { lead } = await createOrGetLead("evt_1", { name: "Ana", email, phone: null });
  if (answered) await emit("evt_1", lead.id, "survey.completed", {});
  return lead;
}

const live = (over: Partial<LiveInput> = {}) =>
  createLive("evt_1", { title: "Live", durationMin: 90, ...over });

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("GET /api/evento/lives (agenda)", () => {
  it("reflete os estados por horário e NUNCA vaza url de embed", async () => {
    await live({ title: "Ao vivo", startsAt: at(-10), streamUrl: "stream" });
    await live({ title: "Em breve", startsAt: at(120) });
    await live({ title: "Gravação", startsAt: at(-300), recordingUrl: "rec" });
    const l = await lead(true);

    const res = await get({ leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    const byTitle = (t: string) => data.lives.find((x: { title: string }) => x.title === t);

    expect(byTitle("Ao vivo").state).toBe("live");
    expect(byTitle("Ao vivo").watchable).toBe(true);
    expect(byTitle("Em breve").state).toBe("scheduled");
    expect(byTitle("Em breve").watchable).toBe(false);
    expect(byTitle("Gravação").state).toBe("recording");
    expect(byTitle("Gravação").hasRecording).toBe(true);

    for (const x of data.lives) {
      expect(x).not.toHaveProperty("streamUrl");
      expect(x).not.toHaveProperty("recordingUrl");
    }
  });

  it("visitante sem sessão ⇒ watchable:false", async () => {
    await live({ title: "Ao vivo", startsAt: at(-10), streamUrl: "stream" });
    const data = await (await get()).json();
    expect(data.authenticated).toBe(false);
    expect(data.lives[0].watchable).toBe(false);
  });

  it("gate não satisfeito ⇒ watchable:false mesmo ao vivo", async () => {
    await live({ title: "Ao vivo", startsAt: at(-10), streamUrl: "stream" });
    const l = await lead(false, "nogate@x.com");
    const data = await (await get({ leadId: l.id, eventId: "evt_1" })).json();
    expect(data.surveyAnswered).toBe(false);
    expect(data.lives[0].watchable).toBe(false);
  });

  it("sem lives ⇒ lives:[]", async () => {
    const l = await lead(true);
    const data = await (await get({ leadId: l.id, eventId: "evt_1" })).json();
    expect(data.lives).toEqual([]);
  });
});

describe("POST /api/evento/lives/[id]/abrir (assistir + medir)", () => {
  it("401 sem sessão", async () => {
    const lv = await live({ startsAt: at(-10), streamUrl: "s" });
    expect((await abrir(lv.id)).status).toBe(401);
  });

  it("404 para live inexistente", async () => {
    const l = await lead(true);
    expect((await abrir("live_nao", { leadId: l.id, eventId: "evt_1" })).status).toBe(404);
  });

  it("403 gated quando o lead não respondeu a pesquisa", async () => {
    const lv = await live({ startsAt: at(-10), streamUrl: "s" });
    const l = await lead(false, "g@x.com");
    const res = await abrir(lv.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("gated");
  });

  it("ao vivo ⇒ 200 com stream + emite live.opened {liveId,state:'live'}", async () => {
    const lv = await live({ startsAt: at(-10), streamUrl: "stream-embed" });
    const l = await lead(true);
    const res = await abrir(lv.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ state: "live", resource: "stream-embed", external: false });
    const { rows } = await query(
      "SELECT data FROM engagement_events WHERE lead_id = $1 AND type = 'live.opened'",
      [l.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({ liveId: lv.id, state: "live" });
  });

  it("gravação ⇒ 200 com recording + live.opened state:'recording'", async () => {
    const lv = await live({ startsAt: at(-300), recordingUrl: "rec-embed" });
    const l = await lead(true, "r@x.com");
    const data = await (await abrir(lv.id, { leadId: l.id, eventId: "evt_1" })).json();
    expect(data.state).toBe("recording");
    expect(data.resource).toBe("rec-embed");
  });

  it("em breve ⇒ 403 not_watchable e NÃO emite live.opened", async () => {
    const lv = await live({ startsAt: at(120), streamUrl: "s" });
    const l = await lead(true, "eb@x.com");
    const res = await abrir(lv.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_watchable");
    const { rows } = await query(
      "SELECT 1 FROM engagement_events WHERE lead_id = $1 AND type = 'live.opened'",
      [l.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("encerrada (sem gravação) ⇒ 403 not_watchable", async () => {
    const lv = await live({ startsAt: at(-300) });
    const l = await lead(true, "en@x.com");
    const res = await abrir(lv.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_watchable");
  });
});
