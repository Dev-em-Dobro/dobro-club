import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { query } from "@/lib/db";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { signSession } from "@/lib/auth/session";
import { GET } from "@/app/api/evento/route";

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

function get(session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  return GET(new NextRequest("http://localhost/api/evento", { headers }));
}

beforeEach(async () => {
  await useTestDb();
});

describe("GET /api/evento", () => {
  it("401 sem sessão", async () => {
    await seedEvent({ id: "evt_1", slug: "piloto" });
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("404 quando o lead da sessão não existe", async () => {
    await seedEvent({ id: "evt_1", slug: "piloto" });
    const res = await get({ leadId: "lead_inexistente", eventId: "evt_1" });
    expect(res.status).toBe(404);
  });

  it("200 provisória antes da janela: ticket + windowOpensAt no futuro, sem vazar token", async () => {
    await seedEvent({ id: "evt_1", slug: "piloto", weekStartsAt: iso(30 * DAY) });
    const { lead } = await createOrGetLead("evt_1", {
      name: "Maria",
      email: "m@x.com",
      phone: null,
    });
    const res = await get({ leadId: lead.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.phase).toBe("provisoria");
    expect(data.ticket).toHaveProperty("imageUrl");
    expect(data.ticket).toHaveProperty("qrValue");
    expect(new Date(data.windowOpensAt).getTime()).toBeGreaterThan(Date.now());
    expect(data.lead.id).toBe(lead.id);
    expect(data.lead).not.toHaveProperty("token");
    expect(data.surveyAnswered).toBe(false);
  });

  it("emite hub.viewed com { phase } ao acessar", async () => {
    await seedEvent({ id: "evt_1", slug: "piloto", weekStartsAt: iso(30 * DAY) });
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "m@x.com", phone: null });
    await get({ leadId: lead.id, eventId: "evt_1" });
    const { rows } = await query(
      "SELECT type, data FROM engagement_events WHERE lead_id = $1 AND type = 'hub.viewed'",
      [lead.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].data).toMatchObject({ phase: "provisoria" });
  });

  it("acessos repetidos não criam credencial/lead nova (derivada — INV-2)", async () => {
    await seedEvent({ id: "evt_1", slug: "piloto", weekStartsAt: iso(30 * DAY) });
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "m@x.com", phone: null });
    await get({ leadId: lead.id, eventId: "evt_1" });
    await get({ leadId: lead.id, eventId: "evt_1" });
    const { rows } = await query("SELECT count(*)::int AS n FROM leads", []);
    expect(rows[0].n).toBe(1);
  });

  it("phase 'oficial' quando a janela já abriu (T-3 dias) — US2", async () => {
    // semana começa em 1 dia ⇒ janela (T-3) já abriu
    await seedEvent({ id: "evt_1", slug: "piloto", weekStartsAt: iso(1 * DAY) });
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "m@x.com", phone: null });
    const data = await (await get({ leadId: lead.id, eventId: "evt_1" })).json();
    expect(data.phase).toBe("oficial");
  });

  it("surveyAnswered reflete survey.completed — US3", async () => {
    await seedEvent({ id: "evt_1", slug: "piloto", weekStartsAt: iso(30 * DAY) });
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "m@x.com", phone: null });
    await emit("evt_1", lead.id, "survey.completed", {});
    const data = await (await get({ leadId: lead.id, eventId: "evt_1" })).json();
    expect(data.surveyAnswered).toBe(true);
  });
});
