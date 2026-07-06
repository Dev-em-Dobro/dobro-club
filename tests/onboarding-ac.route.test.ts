import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { getLeadByEmail } from "@/lib/leads";

// A gravação no AC é efeito externo best-effort — mockada para asserir "chamou / não chamou".
vi.mock("@/lib/activecampaign", () => ({
  syncMagicLinkToAC: vi.fn().mockResolvedValue({ sent: true }),
}));

import { syncMagicLinkToAC } from "@/lib/activecampaign";
import { POST } from "@/app/api/e/[slug]/onboarding-ac/route";

/** Monta a request como o AC (form-urlencoded) ou como JSON, com ?key= na URL. */
function post(
  slug: string,
  fields: Record<string, string>,
  key: string | null = "k",
  mode: "form" | "json" = "form",
) {
  const qs = key === null ? "" : `?key=${encodeURIComponent(key)}`;
  const url = `http://localhost/api/e/${slug}/onboarding-ac${qs}`;
  const init: { method: string; headers: Record<string, string>; body: string } =
    mode === "json"
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(fields),
        }
      : {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(fields).toString(),
        };
  const req = new NextRequest(url, init);
  return POST(req, { params: Promise.resolve({ slug }) });
}

const acFields = {
  "contact[first_name]": "Ana",
  "contact[last_name]": "Souza",
  "contact[email]": "ANA@X.com",
  "contact[phone]": "+55 11 99999-8888",
};

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto", apiKey: "k", onboardingChannel: "active-campaign" });
  vi.clearAllMocks();
});

describe("POST /api/e/[slug]/onboarding-ac — ingestão nativa do ActiveCampaign", () => {
  it("cria o lead (form do AC), grava o link no AC e responde 200", async () => {
    const res = await post("piloto", acFields);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isNew).toBe(true);
    expect(typeof data.magicLink).toBe("string");
    expect(data.acSync).toBe(true);

    // lead persistido com e-mail canônico (minúsculo) e nome combinado
    const lead = await getLeadByEmail("evt_1", "ana@x.com");
    expect(lead?.id).toBe(data.leadId);
    expect(lead?.name).toBe("Ana Souza");
    expect(lead?.phone).toBe("5511999998888");

    // sync chamado com (email, magicLink)
    expect(syncMagicLinkToAC).toHaveBeenCalledTimes(1);
    expect(syncMagicLinkToAC).toHaveBeenCalledWith("ana@x.com", data.magicLink);
  });

  it("aceita corpo JSON também (tolerante)", async () => {
    const res = await post("piloto", { email: "bia@x.com", name: "Bia" }, "k", "json");
    expect(res.status).toBe(200);
    expect((await res.json()).acSync).toBe(true);
  });

  it("sem ?key= ⇒ 401 e não grava no AC", async () => {
    const res = await post("piloto", acFields, null);
    expect(res.status).toBe(401);
    expect(syncMagicLinkToAC).not.toHaveBeenCalled();
  });

  it("?key= errada ⇒ 401", async () => {
    const res = await post("piloto", acFields, "errada");
    expect(res.status).toBe(401);
    expect(syncMagicLinkToAC).not.toHaveBeenCalled();
  });

  it("evento inexistente ⇒ 404", async () => {
    const res = await post("nao-existe", acFields);
    expect(res.status).toBe(404);
    expect(syncMagicLinkToAC).not.toHaveBeenCalled();
  });

  it("sem e-mail nem telefone ⇒ 400", async () => {
    const res = await post("piloto", { "contact[first_name]": "Ana" });
    expect(res.status).toBe(400);
    expect(syncMagicLinkToAC).not.toHaveBeenCalled();
  });

  it("idempotente: re-ingestão não duplica, mesmo link e re-grava no AC (auto-cura)", async () => {
    const first = await (await post("piloto", acFields)).json();
    expect(first.isNew).toBe(true);

    const second = await (await post("piloto", { ...acFields, "contact[first_name]": "Ana Maria" })).json();
    expect(second.isNew).toBe(false);
    expect(second.magicLink).toBe(first.magicLink);
    // sync roda nas DUAS ingestões (não só na criação)
    expect(syncMagicLinkToAC).toHaveBeenCalledTimes(2);
  });
});
