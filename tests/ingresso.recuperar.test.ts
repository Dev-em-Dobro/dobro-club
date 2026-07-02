import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { resetLimitersForTests } from "@/lib/ratelimit";
import { createOrGetLead } from "@/lib/leads";
import { POST } from "@/app/api/e/[slug]/ingresso/recuperar/route";

function post(slug: string, body: unknown, ip = "9.9.9.9") {
  const req = new Request(`http://localhost/api/e/${slug}/ingresso/recuperar`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  return POST(req as never, { params: Promise.resolve({ slug }) });
}

const NEUTRAL_MSG =
  "Se este e-mail estiver cadastrado, enviamos o link de acesso.";

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto" });
  resetLimitersForTests();
});

describe("POST /api/e/[slug]/ingresso/recuperar", () => {
  it("resposta neutra idêntica para e-mail existente e inexistente (FR-018)", async () => {
    await createOrGetLead("evt_1", {
      name: "Maria",
      email: "maria@exemplo.com",
      phone: null,
    });

    const existing = await post("piloto", { email: "maria@exemplo.com" });
    const missing = await post(
      "piloto",
      { email: "ninguem@exemplo.com" },
      "9.9.9.10",
    );

    expect(existing.status).toBe(200);
    expect(missing.status).toBe(200);
    const a = await existing.json();
    const b = await missing.json();
    expect(a).toEqual({ ok: true, message: NEUTRAL_MSG });
    expect(b).toEqual(a);
  });

  it("o corpo nunca contém magicLink nem leadId (SC-006, FR-017)", async () => {
    await createOrGetLead("evt_1", {
      name: "Maria",
      email: "maria@exemplo.com",
      phone: null,
    });
    const body = await (
      await post("piloto", { email: "maria@exemplo.com" })
    ).json();
    expect(JSON.stringify(body)).not.toMatch(/magicLink|leadId|entrar\//i);
  });

  it("400 para e-mail ausente/inválido", async () => {
    expect((await post("piloto", {})).status).toBe(400);
    expect((await post("piloto", { email: "nope" }, "9.9.9.11")).status).toBe(
      400,
    );
  });

  it("404 para slug inexistente", async () => {
    expect((await post("nao-existe", { email: "a@b.com" })).status).toBe(404);
  });
});
