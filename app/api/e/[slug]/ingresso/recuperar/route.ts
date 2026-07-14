import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug, isTicketOnly } from "@/lib/events";
import { getLeadByEmail } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { sendMagicLinkEmail } from "@/lib/email";
import { makeLimiter, clientIp } from "@/lib/ratelimit";

// Recuperação pública: rate limit mais estrito para conter enumeração/spam.
const limiter = makeLimiter({ windowMs: 60_000, max: 5 });

// Resposta neutra e idêntica exista ou não o e-mail (FR-017/FR-018, SC-006).
const NEUTRAL = {
  ok: true,
  message: "Se este e-mail estiver cadastrado, enviamos o link de acesso.",
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const rl = limiter.check(`recuperar:${clientIp(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "muitas tentativas, tente novamente em instantes" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });
  }
  // Evento "só ingresso" não tem acesso a recuperar: a rota não existe para ele.
  if (isTicketOnly(event)) {
    return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "e-mail inválido" }, { status: 400 });
  }

  // Reenvio best-effort. Só age se o lead existir e não estiver revogado, mas
  // a resposta é SEMPRE a mesma (não revela existência do e-mail).
  const lead = await getLeadByEmail(event.id, email);
  if (lead && !lead.revoked) {
    const magicLink = buildMagicLink(lead.token);
    sendMagicLinkEmail({
      to: lead.email,
      name: lead.name,
      eventName: event.name,
      magicLink,
    })
      .then((r) => {
        if (!r.sent) console.warn("[recuperar] email not sent:", r.reason);
      })
      .catch((e) => console.error("[recuperar] email error:", e));
  }

  // O corpo NUNCA contém magicLink nem leadId (SC-006, FR-017).
  return NextResponse.json(NEUTRAL);
}
