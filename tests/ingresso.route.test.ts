import { describe, it, expect, beforeEach } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { resetLimitersForTests } from "@/lib/ratelimit";
import { query } from "@/lib/db";
import { POST } from "@/app/api/e/[slug]/ingresso/route";

function post(slug: string, body: unknown) {
  const req = new Request(`http://localhost/api/e/${slug}/ingresso`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
  return POST(req as never, { params: Promise.resolve({ slug }) });
}

const valid = {
  name: "Maria Silva",
  email: "maria@exemplo.com",
  phone: "+5511999998888",
  consent: true,
};

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto" });
  resetLimitersForTests();
});

describe("POST /api/e/[slug]/ingresso", () => {
  it("cria lead e retorna magicLink + ticket (FR-001,002,005)", async () => {
    const res = await post("piloto", valid);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isNew).toBe(true);
    expect(data.leadId).toMatch(/^lead_/);
    expect(data.magicLink).toContain("/entrar/");
    expect(data.ticket.imageUrl).toBeTruthy();
    expect(data.ticket.qrValue).toBe(
      `http://localhost:3000/ingresso?ref=${data.leadId}`,
    );
    // O QR/shareUrl nunca embutem o token (SC-006).
    expect(data.ticket.qrValue).not.toContain("/entrar/");
  });

  it("é idempotente por e-mail OU telefone (FR-002,014)", async () => {
    const first = await (await post("piloto", valid)).json();
    const sameEmail = await (
      await post("piloto", { ...valid, phone: "+550000000000" })
    ).json();
    expect(sameEmail.isNew).toBe(false);
    expect(sameEmail.leadId).toBe(first.leadId);

    const samePhone = await (
      await post("piloto", { ...valid, email: "outro@exemplo.com" })
    ).json();
    expect(samePhone.isNew).toBe(false);
    expect(samePhone.leadId).toBe(first.leadId);
  });

  it("persiste a foto quando enviada (FR-015)", async () => {
    const photoUrl = "https://res.cloudinary.com/x/image/upload/maria.jpg";
    const data = await (await post("piloto", { ...valid, photoUrl })).json();
    const { rows } = await query("SELECT photo_url FROM leads WHERE id = $1", [
      data.leadId,
    ]);
    expect(rows[0].photo_url).toBe(photoUrl);
  });

  it("exige consentimento (FR-013)", async () => {
    const res = await post("piloto", { ...valid, consent: false });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/consentimento/i);
  });

  it("rejeita e-mail inválido sem telefone (FR-001)", async () => {
    const res = await post("piloto", {
      name: "X",
      email: "nope",
      consent: true,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).errors).toBeTruthy();
  });

  it("404 para slug inexistente", async () => {
    const res = await post("nao-existe", valid);
    expect(res.status).toBe(404);
  });
});
