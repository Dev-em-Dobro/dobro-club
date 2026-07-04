import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { createOrGetLead } from "@/lib/leads";
import { emit } from "@/lib/engagement";
import { getLeadScore, listEventScores } from "@/lib/score";

async function leadWith(email: string, types: string[], eventId = "evt_1") {
  const { lead } = await createOrGetLead(eventId, { name: email.split("@")[0], email, phone: null });
  for (const t of types) await emit(eventId, lead.id, t as never, {});
  return lead;
}

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k" });
  await seedEvent({ id: "evt_2", slug: "outro", apiKey: "k2" });
});

describe("getLeadScore (US1)", () => {
  it("soma os pesos dos eventos do lead + breakdown coerente", async () => {
    // survey.completed(10) + live.opened(5) + content.opened×2(4) = 19
    const l = await leadWith("a@x.com", [
      "survey.completed",
      "live.opened",
      "content.opened",
      "content.opened",
    ]);
    const r = await getLeadScore("evt_1", l.id);
    expect(r.score).toBe(19);
    expect(r.breakdown.reduce((s, b) => s + b.points, 0)).toBe(19);
    expect(r.breakdown.find((b) => b.type === "content.opened")).toMatchObject({
      count: 2,
      weight: 2,
      points: 4,
    });
  });

  it("adicionar um evento de peso P sobe o score em P", async () => {
    const l = await leadWith("b@x.com", ["hub.viewed"]); // 1
    expect((await getLeadScore("evt_1", l.id)).score).toBe(1);
    await emit("evt_1", l.id, "survey.completed" as never, {}); // +10
    expect((await getLeadScore("evt_1", l.id)).score).toBe(11);
  });

  it("lead sem eventos ⇒ score 0, breakdown []", async () => {
    const l = await leadWith("c@x.com", []);
    expect(await getLeadScore("evt_1", l.id)).toEqual({ leadId: l.id, score: 0, breakdown: [] });
  });

  it("isolamento por evento: eventos de outro evento não contam", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: "D", email: "d@x.com", phone: null });
    await emit("evt_2", lead.id, "survey.completed" as never, {}); // outro evento
    expect((await getLeadScore("evt_1", lead.id)).score).toBe(0);
  });

  it("tipo sem peso ⇒ contribui 0 (não quebra)", async () => {
    const l = await leadWith("e@x.com", ["hub.viewed"]);
    await emit("evt_1", l.id, "algo.novo" as never, {});
    const r = await getLeadScore("evt_1", l.id);
    expect(r.score).toBe(1);
    expect(r.breakdown.find((b) => b.type === "algo.novo")).toMatchObject({ weight: 0, points: 0 });
  });
});

describe("listEventScores (US2)", () => {
  it("ordena por score desc; inclui name/email", async () => {
    const a = await leadWith("alta@x.com", ["survey.completed", "live.opened"]); // 15
    const b = await leadWith("baixa@x.com", ["hub.viewed"]); // 1
    const ranked = await listEventScores("evt_1");
    expect(ranked.map((r) => r.leadId)).toEqual([a.id, b.id]);
    expect(ranked[0]).toMatchObject({ score: 15, email: "alta@x.com", name: "alta" });
    expect(ranked[1].score).toBe(1);
  });

  it("empate ⇒ desempate estável por leadId asc", async () => {
    const a = await leadWith("p1@x.com", ["content.opened"]); // 2
    const b = await leadWith("p2@x.com", ["content.opened"]); // 2
    const ranked = await listEventScores("evt_1");
    const [first, second] = [a.id, b.id].sort();
    expect(ranked.map((r) => r.leadId)).toEqual([first, second]);
  });

  it("evento sem eventos ⇒ []", async () => {
    expect(await listEventScores("evt_1")).toEqual([]);
  });

  it("isolamento por evento", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: "X", email: "x@x.com", phone: null });
    await emit("evt_2", lead.id, "survey.completed" as never, {});
    expect(await listEventScores("evt_1")).toEqual([]);
  });
});
