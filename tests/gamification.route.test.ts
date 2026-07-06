import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { signSession } from "@/lib/auth/session";
import { GET as participanteGET } from "@/app/api/evento/gamificacao/route";
import { GET as adminGET } from "@/app/api/events/[eventId]/leads/[leadId]/gamification/route";

function participanteReq(session?: { leadId: string; eventId: string }) {
  const headers: Record<string, string> = {};
  if (session) headers.cookie = `dc_session=${signSession(session)}`;
  return participanteGET(new NextRequest("http://localhost/api/evento/gamificacao", { headers }));
}

function adminReq(eventId: string, leadId: string, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  const req = new NextRequest(
    `http://localhost/api/events/${eventId}/leads/${leadId}/gamification`,
    { headers },
  );
  return adminGET(req, { params: Promise.resolve({ eventId, leadId }) });
}

const badge = (
  badges: Array<{ id: string; earned: boolean; criterion: string }>,
  id: string,
) => badges.find((b) => b.id === id)!;

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("GET /api/evento/gamificacao (participante — US1/US2)", () => {
  it("401 sem sessão", async () => {
    expect((await participanteReq()).status).toBe(401);
  });

  it("200 devolve streak+badges do próprio lead; atividade hoje ⇒ streak >= 1", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: "Ana", email: "a@x.com", phone: null });
    await emit("evt_1", lead.id, "live.opened", { liveId: "l1", state: "live" });
    const res = await participanteReq({ leadId: lead.id, eventId: "evt_1" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.streak.current).toBeGreaterThanOrEqual(1);
    expect(badge(data.badges, "primeira-live").earned).toBe(true); // US2
    expect(badge(data.badges, "explorador").earned).toBe(false);
    expect(badge(data.badges, "explorador").criterion).toBeTruthy();
  });

  it("lead sem eventos ⇒ streak {0,0} e nenhum badge earned", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: "B", email: "b@x.com", phone: null });
    const data = await (await participanteReq({ leadId: lead.id, eventId: "evt_1" })).json();
    expect(data.streak).toEqual({ current: 0, longest: 0 });
    expect(data.badges.every((b: { earned: boolean }) => !b.earned)).toBe(true);
  });
});

describe("GET /api/events/[eventId]/leads/[leadId]/gamification (admin — US3)", () => {
  it("401 sem X-Api-Key", async () => {
    expect((await adminReq("evt_1", "lead_x")).status).toBe(401);
  });

  it("401 com X-Api-Key errada", async () => {
    expect((await adminReq("evt_1", "lead_x", "errada")).status).toBe(401);
  });

  it("404 para evento inexistente", async () => {
    expect((await adminReq("evt_nao", "lead_x", "k")).status).toBe(404);
  });

  it("200 devolve streak+badges de um lead", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: "C", email: "c@x.com", phone: null });
    for (let i = 0; i < 5; i++) await emit("evt_1", lead.id, "content.opened", { itemId: `c${i}` });
    const res = await adminReq("evt_1", lead.id, "k");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(badge(data.badges, "explorador").earned).toBe(true); // 5 conteúdos
    expect(data.streak.current).toBeGreaterThanOrEqual(1);
  });
});
