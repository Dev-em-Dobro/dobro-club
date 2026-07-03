import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { createContentItem } from "@/lib/content";
import { signSession } from "@/lib/auth/session";
import { GET } from "@/app/api/evento/conteudo/route";

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

function get(session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  return GET(new NextRequest("http://localhost/api/evento/conteudo", { headers }));
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

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("GET /api/evento/conteudo", () => {
  it("público sem sessão: lista travada (authenticated:false)", async () => {
    await createContentItem("evt_1", {
      kind: "lesson",
      title: "Aula 1",
      resource: "x",
      releaseAt: null,
    });
    const res = await get();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(false);
    expect(data.surveyAnswered).toBe(false);
    expect(data.items[0].available).toBe(false);
    expect(data.items[0]).not.toHaveProperty("resource");
  });

  it("lista itens com available = gate × release e NUNCA vaza resource", async () => {
    await createContentItem("evt_1", {
      kind: "lesson",
      title: "Aula 1",
      resource: "https://youtube.com/embed/abc",
      releaseAt: null,
      position: 1,
    });
    const l = await lead(true);
    const res = await get({ leadId: l.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.surveyAnswered).toBe(true);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].available).toBe(true);
    expect(data.items[0]).not.toHaveProperty("resource");
  });

  it("gate: sem survey.completed, tudo available:false", async () => {
    await createContentItem("evt_1", {
      kind: "lesson",
      title: "Aula 1",
      resource: "x",
      releaseAt: null,
    });
    const l = await lead(false);
    const data = await (await get({ leadId: l.id, eventId: "evt_1" })).json();
    expect(data.surveyAnswered).toBe(false);
    expect(data.items[0].available).toBe(false);
  });

  it("drip: item com releaseAt futuro fica available:false mesmo com gate", async () => {
    await createContentItem("evt_1", {
      kind: "lesson",
      title: "Aula futura",
      resource: "x",
      releaseAt: iso(5 * DAY),
    });
    const l = await lead(true);
    const data = await (await get({ leadId: l.id, eventId: "evt_1" })).json();
    expect(data.items[0].available).toBe(false);
    expect(new Date(data.items[0].releaseAt).getTime()).toBeGreaterThan(Date.now());
  });
});
