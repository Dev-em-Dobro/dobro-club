import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { GET as leadScoreGET } from "@/app/api/events/[eventId]/leads/[leadId]/score/route";
import { GET as scoresGET } from "@/app/api/events/[eventId]/scores/route";

function leadScoreReq(eventId: string, leadId: string, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  const req = new NextRequest(
    `http://localhost/api/events/${eventId}/leads/${leadId}/score`,
    { headers },
  );
  return leadScoreGET(req, { params: Promise.resolve({ eventId, leadId }) });
}

function scoresReq(eventId: string, apiKey?: string) {
  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  const req = new NextRequest(`http://localhost/api/events/${eventId}/scores`, { headers });
  return scoresGET(req, { params: Promise.resolve({ eventId }) });
}

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
});

describe("GET /api/events/[eventId]/leads/[leadId]/score (US1)", () => {
  it("401 sem X-Api-Key", async () => {
    expect((await leadScoreReq("evt_1", "lead_x")).status).toBe(401);
  });

  it("401 com X-Api-Key errada", async () => {
    expect((await leadScoreReq("evt_1", "lead_x", "errada")).status).toBe(401);
  });

  it("404 para evento inexistente", async () => {
    expect((await leadScoreReq("evt_nao", "lead_x", "k")).status).toBe(404);
  });

  it("200 devolve score + breakdown (sum(points) === score)", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: "Ana", email: "a@x.com", phone: null });
    await emit("evt_1", lead.id, "survey.completed", {}); // 10
    await emit("evt_1", lead.id, "content.opened", {}); //   2
    const res = await leadScoreReq("evt_1", lead.id, "k");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leadId).toBe(lead.id);
    expect(data.score).toBe(12);
    expect(data.breakdown.reduce((s: number, b: { points: number }) => s + b.points, 0)).toBe(12);
  });
});

describe("GET /api/events/[eventId]/scores (US2)", () => {
  it("401 sem X-Api-Key", async () => {
    expect((await scoresReq("evt_1")).status).toBe(401);
  });

  it("404 para evento inexistente", async () => {
    expect((await scoresReq("evt_nao", "k")).status).toBe(404);
  });

  it("200 devolve ranking ordenado por score desc", async () => {
    const { lead: a } = await createOrGetLead("evt_1", { name: "Alta", email: "alta@x.com", phone: null });
    const { lead: b } = await createOrGetLead("evt_1", { name: "Baixa", email: "baixa@x.com", phone: null });
    await emit("evt_1", a.id, "survey.completed", {}); // 10
    await emit("evt_1", b.id, "hub.viewed", {}); //        1
    const res = await scoresReq("evt_1", "k");
    expect(res.status).toBe(200);
    const { scores } = await res.json();
    expect(scores.map((s: { leadId: string }) => s.leadId)).toEqual([a.id, b.id]);
    expect(scores[0].score).toBeGreaterThan(scores[1].score);
  });
});
