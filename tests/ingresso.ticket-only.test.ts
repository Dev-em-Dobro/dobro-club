import { describe, it, expect, beforeEach, vi } from "vitest";
import { useTestDb, seedEvent } from "./helpers/testdb";
import { resetLimitersForTests } from "@/lib/ratelimit";
import { query } from "@/lib/db";

// O e-mail é o ponto central deste modo: no evento pago a plataforma NÃO manda
// nada. Mockado para verificar a ausência da chamada (e não tocar a rede).
const sendMagicLinkEmail = vi.fn(async () => ({ sent: true }));
vi.mock("@/lib/email", () => ({
  sendMagicLinkEmail: (...args: unknown[]) => sendMagicLinkEmail(...(args as [])),
}));

const { POST } = await import("@/app/api/e/[slug]/ingresso/route");
const { POST: RECUPERAR } = await import(
  "@/app/api/e/[slug]/ingresso/recuperar/route"
);
const { POST: ACESSAR } = await import(
  "@/app/api/e/[slug]/ingresso/acessar/route"
);

// `req: never` deixa os Route Handlers (que pedem NextRequest) atribuíveis aqui —
// mesmo truque do `POST(req as never, …)` das outras suítes.
type Handler = (
  req: never,
  ctx: { params: Promise<{ slug: string }> },
) => Promise<Response>;

function post(handler: Handler, slug: string, body: unknown, path = "ingresso") {
  const req = new Request(`http://localhost/api/e/${slug}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(body),
  });
  return handler(req as never, { params: Promise.resolve({ slug }) });
}

const valid = {
  name: "Maria Silva",
  email: "maria@exemplo.com",
  phone: "+5511999998888",
  consent: true,
};

beforeEach(async () => {
  await useTestDb();
  // `imersao` = evento pago (só ingresso); `piloto` = evento completo (regressão).
  await seedEvent({ id: "evt_pago", slug: "imersao", mode: "ticket-only" });
  await seedEvent({ id: "evt_full", slug: "piloto" });
  resetLimitersForTests();
  sendMagicLinkEmail.mockClear();
});

describe("evento ticket-only — gerador de ingresso do evento pago", () => {
  it("gera o ingresso, grava o lead e NÃO devolve magic link", async () => {
    const res = await post(POST, "imersao", valid);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.isNew).toBe(true);
    expect(data.magicLink).toBeUndefined();
    expect(data.ticket.imageUrl).toBeTruthy();
    expect(data.ticket.downloadUrl).toBeTruthy();

    const { rows } = await query("SELECT name, email, phone FROM leads WHERE id = $1", [
      data.leadId,
    ]);
    expect(rows[0]).toMatchObject({
      name: "Maria Silva",
      email: "maria@exemplo.com",
      phone: "5511999998888",
    });
  });

  it("não envia e-mail nenhum (sem recuperação por e-mail)", async () => {
    await post(POST, "imersao", valid);
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("o QR/compartilhar apontam para o gerador DO evento, sem token (SC-006)", async () => {
    const data = await (await post(POST, "imersao", valid)).json();
    expect(data.ticket.qrValue).toBe(
      `http://localhost:3000/e/imersao/ingresso?ref=${data.leadId}`,
    );
    expect(data.ticket.shareUrl).toBe(data.ticket.qrValue);
    expect(data.ticket.qrValue).not.toContain("/entrar/");
  });

  it("recuperar por e-mail responde 404 (a rota não existe neste evento)", async () => {
    const res = await post(
      RECUPERAR,
      "imersao",
      { email: valid.email },
      "ingresso/recuperar",
    );
    expect(res.status).toBe(404);
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("acessar por telefone responde 404 (a rota não existe neste evento)", async () => {
    await post(POST, "imersao", valid);
    const res = await post(
      ACESSAR,
      "imersao",
      { phone: valid.phone },
      "ingresso/acessar",
    );
    expect(res.status).toBe(404);
  });

  it("evento completo segue com magic link e e-mail (regressão)", async () => {
    const res = await post(POST, "piloto", valid);
    const data = await res.json();
    expect(data.magicLink).toContain("/entrar/");
    expect(data.ticket.qrValue).toBe(
      `http://localhost:3000/ingresso?ref=${data.leadId}`,
    );
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
  });
});
