import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { resetLimitersForTests } from "@/lib/ratelimit";
import { createOrGetLead } from "@/lib/leads";
import { POST } from "@/app/api/e/[slug]/ingresso/acessar/route";

function post(slug: string, body: unknown, ip = "8.8.8.8") {
  const req = new Request(`http://localhost/api/e/${slug}/ingresso/acessar`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
  return POST(req as never, { params: Promise.resolve({ slug }) });
}

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto" });
  resetLimitersForTests();
});

describe("POST /api/e/[slug]/ingresso/acessar", () => {
  it("devolve o magic link para um telefone cadastrado", async () => {
    await createOrGetLead("evt_1", {
      name: "Maria",
      email: null,
      phone: "5511999999999",
    });
    const res = await post("piloto", { phone: "+55 11 99999-9999" }); // formatado
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.name).toBe("Maria");
    expect(data.magicLink).toContain("/entrar/");
  });

  it("404 quando o telefone não existe", async () => {
    const res = await post("piloto", { phone: "5511000000000" });
    expect(res.status).toBe(404);
    expect((await res.json()).ok).toBe(false);
  });

  it("400 para telefone em formato inválido", async () => {
    expect((await post("piloto", { phone: "123" })).status).toBe(400);
    expect((await post("piloto", {}, "8.8.8.9")).status).toBe(400);
  });

  it("404 para slug inexistente", async () => {
    expect((await post("nao-existe", { phone: "5511999999999" })).status).toBe(
      404,
    );
  });
});
