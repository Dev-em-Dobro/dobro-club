import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { query } from "@/lib/db";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { createContentItem, type ContentInput } from "@/lib/content";
import { signSession } from "@/lib/auth/session";
import { POST } from "@/app/api/evento/conteudo/[id]/abrir/route";

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

function abrir(id: string, session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  const req = new NextRequest(`http://localhost/api/evento/conteudo/${id}/abrir`, {
    method: "POST",
    headers,
  });
  return POST(req, { params: Promise.resolve({ id }) });
}

async function lead(answered: boolean) {
  const { lead } = await createOrGetLead("evt_1", {
    name: "Ana",
    email: "a@x.com",
    phone: null,
  });
  if (answered) await emit("evt_1", lead.id, "survey.completed", {});
  return lead;
}

const item = (over: Partial<ContentInput> = {}) =>
  createContentItem("evt_1", {
    kind: "lesson",
    title: "Aula 1",
    resource: "https://youtube.com/embed/abc",
    releaseAt: null,
    ...over,
  });

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("POST /api/evento/conteudo/[id]/abrir", () => {
  it("401 sem sessão", async () => {
    const it0 = await item();
    expect((await abrir(it0.id)).status).toBe(401);
  });

  it("404 para item inexistente", async () => {
    const l = await lead(true);
    expect((await abrir("cont_nao", { leadId: l.id, eventId: "evt_1" })).status).toBe(404);
  });

  it("403 gated quando o lead não respondeu a pesquisa", async () => {
    const it0 = await item();
    const l = await lead(false);
    const res = await abrir(it0.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("gated");
  });

  it("403 not_released quando a data de calendário ainda não chegou (doc)", async () => {
    // 8.16: calendário vale p/ docs; aulas usam drip por-lead (offset × entrada).
    const it0 = await item({ kind: "doc", releaseAt: iso(5 * DAY) });
    const l = await lead(true);
    const res = await abrir(it0.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_released");
  });

  it("200 devolve resource e emite content.opened", async () => {
    const it0 = await item();
    const l = await lead(true);
    const res = await abrir(it0.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resource).toContain("/embed/");
    expect(data.kind).toBe("lesson");
    const { rows } = await query(
      "SELECT data FROM engagement_events WHERE lead_id = $1 AND type = 'content.opened'",
      [l.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({ kind: "lesson", itemId: it0.id });
  });

  it("doc com presente abre e mede (US2)", async () => {
    const it0 = await item({ kind: "doc", title: "E-book", isGift: true, resource: "https://x/doc.pdf" });
    const l = await lead(true);
    const data = await (await abrir(it0.id, { leadId: l.id, eventId: "evt_1" })).json();
    expect(data.kind).toBe("doc");
    expect(data.resource).toBe("https://x/doc.pdf");
  });

  it("item free abre para visitante anônimo (sem sessão) e mede sem lead", async () => {
    const it0 = await item({ isFree: true, resource: "https://youtube.com/embed/free" });
    const res = await abrir(it0.id); // sem sessão
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.resource).toBe("https://youtube.com/embed/free");
    const { rows } = await query(
      "SELECT lead_id FROM engagement_events WHERE type = 'content.opened'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].lead_id).toBeNull();
  });

  it("item free ignora o gate da pesquisa (lead sem survey abre)", async () => {
    const it0 = await item({ isFree: true, resource: "https://youtube.com/embed/free" });
    const l = await lead(false); // NÃO respondeu a pesquisa
    const res = await abrir(it0.id, { leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const { rows } = await query(
      "SELECT lead_id FROM engagement_events WHERE type = 'content.opened'",
    );
    expect(rows[0].lead_id).toBe(l.id);
  });
});
