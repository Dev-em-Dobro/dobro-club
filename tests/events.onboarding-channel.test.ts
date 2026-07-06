import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { getEvent, platformSendsOnboardingEmail } from "@/lib/events";

beforeEach(async () => {
  await useTestDb();
});

describe("events.onboarding_channel (Story 8.15)", () => {
  it("getEvent devolve onboardingChannel", async () => {
    await seedEvent({ id: "evt_ac", onboardingChannel: "active-campaign" });
    const ev = await getEvent("evt_ac");
    expect(ev?.onboardingChannel).toBe("active-campaign");
  });

  it("canal ausente ⇒ platformSendsOnboardingEmail true (padrão 8.1)", async () => {
    await seedEvent({ id: "evt_def" });
    const ev = await getEvent("evt_def");
    expect(ev?.onboardingChannel).toBeNull();
    expect(platformSendsOnboardingEmail(ev)).toBe(true);
  });

  it("canal 'active-campaign' ⇒ platformSendsOnboardingEmail false", async () => {
    await seedEvent({ id: "evt_ac2", onboardingChannel: "active-campaign" });
    const ev = await getEvent("evt_ac2");
    expect(platformSendsOnboardingEmail(ev)).toBe(false);
  });

  it("valor desconhecido ⇒ trata como platform (true)", () => {
    expect(platformSendsOnboardingEmail({ onboardingChannel: "weird" })).toBe(true);
    expect(platformSendsOnboardingEmail({ onboardingChannel: "platform" })).toBe(true);
    expect(platformSendsOnboardingEmail(null)).toBe(true);
  });
});
