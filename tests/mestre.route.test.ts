import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { getLeadByEmail } from "@/lib/leads";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { POST } from "@/app/api/evento/mestre/route";

function post(body: unknown) {
  const req = new NextRequest("http://localhost/api/evento/mestre", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return POST(req);
}

const dados = {
  slug: "piloto",
  name: "Ana Souza",
  email: "ana@x.com",
  phone: "5511999999999",
};

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_1", slug: "piloto" });
});

describe("POST /api/evento/mestre", () => {
  it("cria o lead e loga a sessão (dc_session)", async () => {
    const res = await post(dados);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    // Lead persistido
    const lead = await getLeadByEmail("evt_1", "ana@x.com");
    expect(lead?.id).toBe(data.leadId);
    // Cookie de sessão setado e válido para o lead
    const cookie = res.cookies.get(COOKIE);
    expect(cookie?.value).toBeTruthy();
    const sess = verifySession(cookie!.value);
    expect(sess).toMatchObject({ leadId: data.leadId, eventId: "evt_1" });
  });

  it("400 quando falta algum dos três campos", async () => {
    expect((await post({ ...dados, phone: "" })).status).toBe(400);
    expect((await post({ ...dados, email: "" })).status).toBe(400);
    expect((await post({ ...dados, name: "" })).status).toBe(400);
  });

  it("400 para telefone inválido", async () => {
    expect((await post({ ...dados, phone: "123" })).status).toBe(400);
  });

  it("404 para evento inexistente", async () => {
    expect((await post({ ...dados, slug: "nao-existe" })).status).toBe(404);
  });

  it("idempotente: mesmo e-mail não duplica o lead", async () => {
    const a = await (await post(dados)).json();
    const b = await (await post(dados)).json();
    expect(a.leadId).toBe(b.leadId);
  });
});
