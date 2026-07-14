import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { resetLimitersForTests } from "@/lib/ratelimit";
import { createOrGetLead } from "@/lib/leads";
import { signSession, COOKIE } from "@/lib/auth/session";
import { GET as ENTRAR } from "@/app/entrar/[token]/route";
import { POST as MESTRE } from "@/app/api/evento/mestre/route";
import { GET as ME } from "@/app/api/me/route";

/**
 * O participante do evento pago fica confinado ao gerador: nenhuma porta da
 * plataforma abre para ele. As duas únicas rotas que criam sessão (`/entrar/
 * <token>` e o Mestre) recusam esse evento, e `/api/me` não reconhece um cookie
 * dele. Sem sessão, todo o hub (`/api/evento/*`) já responde 401.
 */

const lead = { name: "Maria Silva", email: "maria@exemplo.com", phone: "5511999998888" };

beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: "evt_pago", slug: "imersao", mode: "ticket-only" });
  await seedEvent({ id: "evt_full", slug: "piloto" });
  resetLimitersForTests();
});

// As rotas leem `req.cookies` — precisa ser NextRequest, não Request.
function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

describe("isolamento do evento ticket-only", () => {
  it("/entrar/<token> do lead pago não cria sessão — devolve ao gerador", async () => {
    const { lead: pago } = await createOrGetLead("evt_pago", lead);

    const res = await ENTRAR(req(`http://localhost/entrar/${pago.token}`), {
      params: Promise.resolve({ token: pago.token }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/e/imersao/ingresso");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("/entrar/<token> do evento completo continua logando (regressão)", async () => {
    const { lead: full } = await createOrGetLead("evt_full", lead);

    const res = await ENTRAR(req(`http://localhost/entrar/${full.token}`), {
      params: Promise.resolve({ token: full.token }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/e/piloto");
    expect(res.headers.get("set-cookie")).toContain(`${COOKIE}=`);
  });

  it("o Mestre recusa o slug do evento pago (o slug vem do cliente)", async () => {
    const res = await MESTRE(
      req("http://localhost/api/evento/mestre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...lead, slug: "imersao" }),
      }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("/api/me rejeita cookie de lead do evento pago", async () => {
    const { lead: pago } = await createOrGetLead("evt_pago", lead);
    const cookie = signSession({ leadId: pago.id, eventId: "evt_pago" });

    const res = await ME(
      req("http://localhost/api/me", {
        headers: { cookie: `${COOKIE}=${cookie}` },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("/api/me segue devolvendo o lead do evento completo (regressão)", async () => {
    const { lead: full } = await createOrGetLead("evt_full", lead);
    const cookie = signSession({ leadId: full.id, eventId: "evt_full" });

    const res = await ME(
      req("http://localhost/api/me", {
        headers: { cookie: `${COOKIE}=${cookie}` },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).leadId).toBe(full.id);
  });
});
