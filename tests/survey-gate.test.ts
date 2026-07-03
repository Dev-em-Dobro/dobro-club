import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { createOrGetLead } from "@/lib/leads";
import { emit, hasCompletedSurvey } from "@/lib/engagement";

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto" });
});

describe("hasCompletedSurvey", () => {
  it("false quando o lead ainda não respondeu a pesquisa", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "a@x.com", phone: null });
    expect(await hasCompletedSurvey(lead.id)).toBe(false);
  });

  it("true depois de survey.completed para o lead", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "a@x.com", phone: null });
    await emit("evt_1", lead.id, "survey.completed", {});
    expect(await hasCompletedSurvey(lead.id)).toBe(true);
  });

  it("é isolado por lead (o de um não libera o outro)", async () => {
    const { lead: a } = await createOrGetLead("evt_1", { name: null, email: "a@x.com", phone: null });
    const { lead: b } = await createOrGetLead("evt_1", { name: null, email: "b@x.com", phone: null });
    await emit("evt_1", a.id, "survey.completed", {});
    expect(await hasCompletedSurvey(a.id)).toBe(true);
    expect(await hasCompletedSurvey(b.id)).toBe(false);
  });

  it("outros tipos de evento não satisfazem o gate", async () => {
    const { lead } = await createOrGetLead("evt_1", { name: null, email: "a@x.com", phone: null });
    await emit("evt_1", lead.id, "hub.viewed", { phase: "provisoria" });
    expect(await hasCompletedSurvey(lead.id)).toBe(false);
  });
});
