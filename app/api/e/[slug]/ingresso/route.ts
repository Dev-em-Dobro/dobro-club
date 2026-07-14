import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug, isTicketOnly } from "@/lib/events";
import { validateLeadInput } from "@/lib/validate";
import { createOrGetLead, setPhoto } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { sendMagicLinkEmail } from "@/lib/email";
import { buildTicket } from "@/lib/ingresso";
import { makeLimiter, clientIp } from "@/lib/ratelimit";

// Captação pública: sem X-Api-Key. Protegida por rate limit + validação +
// consentimento (Complexity Tracking do plan.md).
const limiter = makeLimiter({ windowMs: 60_000, max: 60 });

/**
 * Prova de posse suficiente para reemitir: quem manda **os dois** identificadores
 * do lead (e-mail e telefone) é o dono. `createOrGetLead` casa por e-mail OU
 * telefone — só um deles bastaria para um terceiro mexer no ingresso de outro.
 */
function ownsLead(
  lead: { email: string | null; phone: string | null },
  input: { email: string | null; phone: string | null },
): boolean {
  return (
    !!lead.email &&
    !!lead.phone &&
    lead.email === input.email &&
    lead.phone === input.phone
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const rl = limiter.check(`ingresso:${clientIp(req)}`);
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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.consent !== true) {
    return NextResponse.json(
      { error: "consentimento obrigatório" },
      { status: 400 },
    );
  }

  const { ok, errors, value } = validateLeadInput(body);
  if (!ok) return NextResponse.json({ errors }, { status: 400 });

  const { lead, isNew } = await createOrGetLead(event.id, value);

  // Foto do participante (já subida ao Cloudinary pelo cliente). Best-effort:
  // ausência/erro segue com avatar padrão (FR-003/FR-015).
  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl : null;

  if (isNew) {
    if (photoUrl) {
      await setPhoto(event.id, lead.id, photoUrl);
      lead.photoUrl = photoUrl;
    }
  } else if (body.reissue === true && ownsLead(lead, value)) {
    // Reemissão: o ingresso saiu quebrado (tipicamente a foto derruba a
    // transformação do Cloudinary) e o participante pediu de novo. Só aceita
    // quando e-mail E telefone batem com o lead — assim ninguém reemite, nem
    // apaga a foto, do ingresso alheio a partir de um `?ref=` público.
    await setPhoto(event.id, lead.id, photoUrl);
    lead.photoUrl = photoUrl;
  }

  // Evento "só ingresso" (evento pago): nada de acesso — o participante leva a
  // imagem e o lead fica no banco. Sem e-mail e sem magic link na resposta, para
  // que não exista caminho de entrada/recuperação a ser divulgado.
  const ticketOnly = isTicketOnly(event);
  const ticket = buildTicket(lead, event);

  if (ticketOnly) {
    return NextResponse.json({ leadId: lead.id, isNew, ticket });
  }

  const magicLink = buildMagicLink(lead.token);

  // E-mail com o magic link — best-effort, nunca bloqueia a resposta.
  sendMagicLinkEmail({
    to: lead.email,
    name: lead.name,
    eventName: event.name,
    magicLink,
  })
    .then((r) => {
      if (!r.sent) console.warn("[ingresso] magic-link email not sent:", r.reason);
    })
    .catch((e) => console.error("[ingresso] magic-link email error:", e));

  // FR-005: o magic link é devolvido aqui para exibição na MESMA sessão.
  return NextResponse.json({
    leadId: lead.id,
    isNew,
    magicLink,
    ticket,
  });
}
