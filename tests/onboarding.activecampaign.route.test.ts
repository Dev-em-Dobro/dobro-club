import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";

// Efeitos externos best-effort (Const. VI) mockados para asserir "disparou / não disparou".
vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
vi.mock("@/lib/webhook", () => ({
  fireInscriptionWebhook: vi.fn().mockResolvedValue({ sent: true }),
}));

import { sendMagicLinkEmail } from "@/lib/email";
import { fireInscriptionWebhook } from "@/lib/webhook";
import { POST } from "@/app/api/events/[eventId]/leads/route";

function post(
  eventId: string,
  body: unknown,
  apiKey: string | null = "k", // null ⇒ sem header X-Api-Key
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey !== null) headers["x-api-key"] = apiKey;
  const req = new NextRequest(`http://localhost/api/events/${eventId}/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ eventId }) });
}

beforeEach(async () => {
  await useTestDb();
  vi.clearAllMocks();
});

describe("POST /api/events/[eventId]/leads — onboarding via ActiveCampaign (8.15)", () => {
  // ---- US1: canal decide quem envia o e-mail; webhook sempre sai ----
  it("[US1] canal 'active-campaign': cria lead, NÃO envia e-mail, dispara webhook com o magicLink", async () => {
    await seedEvent({ id: "evt_ac", apiKey: "k", onboardingChannel: "active-campaign", webhookUrl: "https://ac.example/in" });
    const res = await post("evt_ac", { name: "Ana", email: "ana@x.com", phone: null });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isNew).toBe(true);
    expect(typeof data.magicLink).toBe("string");

    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    expect(fireInscriptionWebhook).toHaveBeenCalledTimes(1);
    const [, lead, magicLink] = (fireInscriptionWebhook as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect((lead as { email: string }).email).toBe("ana@x.com");
    expect(magicLink).toBe(data.magicLink);
  });

  it("[US1] canal 'platform' (default): envia e-mail e dispara webhook", async () => {
    await seedEvent({ id: "evt_pf", apiKey: "k", webhookUrl: "https://ac.example/in" });
    const res = await post("evt_pf", { name: "Bia", email: "bia@x.com", phone: null });
    expect(res.status).toBe(200);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    expect(fireInscriptionWebhook).toHaveBeenCalledTimes(1);
  });

  // ---- US2: idempotência sob re-sync da AC ----
  it("[US2] reingestão do mesmo contato: isNew:false, mesmo magicLink, nenhum efeito refeito", async () => {
    await seedEvent({ id: "evt_ac", apiKey: "k", onboardingChannel: "active-campaign" });
    const first = await (await post("evt_ac", { name: "Ana", email: "ana@x.com", phone: null })).json();
    expect(first.isNew).toBe(true);

    vi.clearAllMocks();
    const second = await (await post("evt_ac", { name: "Ana Maria", email: "ana@x.com", phone: null })).json();
    expect(second.isNew).toBe(false);
    expect(second.magicLink).toBe(first.magicLink);
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    expect(fireInscriptionWebhook).not.toHaveBeenCalled();
  });

  // ---- US3: borda (X-Api-Key) e email canônico ----
  it("[US3] sem X-Api-Key ⇒ 401, nenhum efeito", async () => {
    await seedEvent({ id: "evt_ac", apiKey: "k", onboardingChannel: "active-campaign" });
    const res = await post("evt_ac", { name: "Ana", email: "ana@x.com" }, null);
    expect(res.status).toBe(401);
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    expect(fireInscriptionWebhook).not.toHaveBeenCalled();
  });

  it("[US3] X-Api-Key inválida ⇒ 401", async () => {
    await seedEvent({ id: "evt_ac", apiKey: "k", onboardingChannel: "active-campaign" });
    const res = await post("evt_ac", { name: "Ana", email: "ana@x.com" }, "errada");
    expect(res.status).toBe(401);
  });

  it("[US3] email é a identidade canônica: presente no payload do webhook", async () => {
    await seedEvent({ id: "evt_ac", apiKey: "k", onboardingChannel: "active-campaign" });
    await post("evt_ac", { name: "Ana", email: "ANA@X.com", phone: "+5511999998888" });
    const [, lead] = (fireInscriptionWebhook as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect((lead as { email: string }).email).toBe("ana@x.com");
  });
});
