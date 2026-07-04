import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { query } from "@/lib/db";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { createContentItem, type ContentInput } from "@/lib/content";
import { signSession } from "@/lib/auth/session";
import { GET } from "@/app/api/evento/conteudo/route";
import { POST } from "@/app/api/evento/conteudo/[id]/abrir/route";

const DAY = 24 * 60 * 60 * 1000;

function get(session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  return GET(new NextRequest("http://localhost/api/evento/conteudo", { headers }));
}

function abrir(id: string, session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  const req = new NextRequest(`http://localhost/api/evento/conteudo/${id}/abrir`, {
    method: "POST",
    headers,
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

/** Cria um lead com email distinto, gate satisfeito, e `created_at` (entrada) controlável. */
async function leadEnteredDaysAgo(email: string, days: number) {
  const { lead } = await createOrGetLead("evt_1", { name: "L", email, phone: null });
  await query("UPDATE leads SET created_at = $2 WHERE id = $1", [
    lead.id,
    new Date(Date.now() - days * DAY).toISOString(),
  ]);
  await emit("evt_1", lead.id, "survey.completed", {});
  return lead;
}

const lesson = (over: Partial<ContentInput> = {}) =>
  createContentItem("evt_1", {
    kind: "lesson",
    title: "Aula",
    resource: "https://youtube.com/embed/abc",
    releaseAt: null,
    ...over,
  });

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("US1 — liberação por-lead na lista (GET)", () => {
  it("dois leads com entradas diferentes ⇒ available divergente p/ a MESMA aula (offset 2)", async () => {
    const it0 = await lesson({ releaseOffsetDays: 2 });
    const recem = await leadEnteredDaysAgo("recem@x.com", 0);
    const antigo = await leadEnteredDaysAgo("antigo@x.com", 5);

    const dRecem = await (await get({ leadId: recem.id, eventId: "evt_1" })).json();
    const dAntigo = await (await get({ leadId: antigo.id, eventId: "evt_1" })).json();

    const findItem = (d: { items: Array<{ id: string; available: boolean }> }) =>
      d.items.find((i) => i.id === it0.id)!;
    expect(findItem(dRecem).available).toBe(false); // entrou agora, offset 2 ainda não
    expect(findItem(dAntigo).available).toBe(true); // entrou há 5 dias, já liberou
  });

  it("aula futura p/ o lead ⇒ available:false + releaseForLeadAt = entrada+offset", async () => {
    const it0 = await lesson({ releaseOffsetDays: 3 });
    const l = await leadEnteredDaysAgo("ana@x.com", 0);
    const data = await (await get({ leadId: l.id, eventId: "evt_1" })).json();
    const item = data.items.find((i: { id: string }) => i.id === it0.id);
    expect(item.available).toBe(false);
    expect(item.releaseOffsetDays).toBe(3);
    // ~3 dias no futuro a partir da entrada (agora)
    expect(new Date(item.releaseForLeadAt).getTime()).toBeGreaterThan(Date.now() + 2.5 * DAY);
  });

  it("gate não satisfeito ⇒ available:false independentemente do tempo de entrada", async () => {
    const it0 = await lesson({ releaseOffsetDays: 0 });
    const { lead } = await createOrGetLead("evt_1", { name: "L", email: "nogate@x.com", phone: null });
    await query("UPDATE leads SET created_at = $2 WHERE id = $1", [
      lead.id,
      new Date(Date.now() - 30 * DAY).toISOString(),
    ]);
    const data = await (await get({ leadId: lead.id, eventId: "evt_1" })).json();
    expect(data.surveyAnswered).toBe(false);
    expect(data.items.find((i: { id: string }) => i.id === it0.id).available).toBe(false);
  });
});

describe("US1 — revalidação por-lead ao abrir (POST)", () => {
  it("abrir aula NÃO liberada p/ o lead ⇒ 403 not_released e NÃO emite content.opened", async () => {
    const it0 = await lesson({ releaseOffsetDays: 2 });
    const l = await leadEnteredDaysAgo("recem2@x.com", 0);

    const res = await abrir(it0.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_released");

    const { rows } = await query(
      "SELECT 1 FROM engagement_events WHERE lead_id = $1 AND type = 'content.opened'",
      [l.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("US3 — abrir com gate não satisfeito ⇒ 403 gated e NÃO emite content.opened", async () => {
    const it0 = await lesson({ releaseOffsetDays: 0 });
    // lead sem survey.completed (não passa pelo helper que emite o gate)
    const { lead } = await createOrGetLead("evt_1", { name: "L", email: "gate@x.com", phone: null });
    const res = await abrir(it0.id, { leadId: lead.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("gated");
    const { rows } = await query(
      "SELECT 1 FROM engagement_events WHERE lead_id = $1 AND type = 'content.opened'",
      [lead.id],
    );
    expect(rows).toHaveLength(0);
  });

  it("abrir aula liberada p/ o lead ⇒ 200 resource + content.opened emitido", async () => {
    const it0 = await lesson({ releaseOffsetDays: 2 });
    const l = await leadEnteredDaysAgo("antigo2@x.com", 5);
    const res = await abrir(it0.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    expect((await res.json()).resource).toContain("/embed/");
    const { rows } = await query(
      "SELECT data FROM engagement_events WHERE lead_id = $1 AND type = 'content.opened'",
      [l.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({ kind: "lesson", itemId: it0.id });
  });
});
