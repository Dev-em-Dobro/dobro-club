import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug, isTicketOnly } from "@/lib/events";
import { validateLeadInput } from "@/lib/validate";
import {
  createLead,
  getLeadByEmail,
  getLeadById,
  getLeadByPhone,
  setPhoto,
  type Lead,
} from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { sendMagicLinkEmail } from "@/lib/email";
import { tagContactByEmail } from "@/lib/activecampaign";
import { buildTicket } from "@/lib/ingresso";
import { makeLimiter, clientIp } from "@/lib/ratelimit";

// Captação pública: sem X-Api-Key. Protegida por rate limit + validação +
// consentimento (Complexity Tracking do plan.md).
const limiter = makeLimiter({ windowMs: 60_000, max: 60 });

/**
 * Prova de posse suficiente para reemitir: quem manda **os dois** identificadores
 * do lead (e-mail e telefone) é o dono. Um só não basta — quem acerta apenas o
 * telefone (ou apenas o e-mail) de outra pessoa mexeria no ingresso dela.
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

  // Foto do participante (já subida ao Cloudinary pelo cliente). Best-effort:
  // ausência/erro segue com avatar padrão (FR-003/FR-015).
  const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl : null;
  const ticketOnly = isTicketOnly(event);

  // Reemissão: o ingresso saiu quebrado (tipicamente a foto derruba a
  // transformação do Cloudinary) e o participante pediu de novo. Reaproveita o
  // MESMO lead — sem isso cada "saiu errado" viraria uma linha nova. O `leadId`
  // vem da resposta anterior e sozinho não basta: ele circula em `?ref=` público,
  // então e-mail E telefone precisam bater com a linha (`ownsLead`).
  let lead: Lead | null = null;
  let isNew = false;
  if (body.reissue === true && typeof body.leadId === "string") {
    const target = await getLeadById(event.id, body.leadId);
    if (target && ownsLead(target, value)) {
      await setPhoto(event.id, target.id, photoUrl);
      target.photoUrl = photoUrl;
      lead = target;
    }
  }

  if (!lead) {
    lead = await createLead(event.id, value, photoUrl);
    isNew = true;
  }

  // Inserção barrada pelos índices únicos de e-mail/telefone: esses dados já
  // pertencem a OUTRA linha do evento. Nunca devolvemos essa linha — nome, foto
  // e `token` (⇒ magic link) dela seriam entregues a quem fez a requisição, que
  // pode ser um terceiro que só digitou um identificador coincidente. O acesso
  // sai pelo canal que já é do dono: o e-mail cadastrado.
  if (!lead) {
    if (!ticketOnly) {
      const owner =
        (value.email ? await getLeadByEmail(event.id, value.email) : null) ??
        (value.phone ? await getLeadByPhone(event.id, value.phone) : null);
      if (owner?.email) {
        sendMagicLinkEmail({
          to: owner.email,
          name: owner.name,
          eventName: event.name,
          magicLink: buildMagicLink(owner.token),
        }).catch((e) => console.error("[ingresso] reenvio de acesso falhou:", e));
      }
    }
    return NextResponse.json(
      {
        error: ticketOnly
          ? "esses dados já geraram um ingresso neste evento"
          : "esses dados já geraram um ingresso — reenviamos o link de acesso para o e-mail cadastrado",
      },
      { status: 409 },
    );
  }

  // Evento "só ingresso" (evento pago): nada de acesso — o participante leva a
  // imagem e o lead fica no banco. Sem e-mail e sem magic link na resposta, para
  // que não exista caminho de entrada/recuperação a ser divulgado.
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

  // Sinal de check-in no ActiveCampaign: tag que dispara a automação de quem
  // gerou o ingresso (só lançamento clássico — o ticket-only já retornou acima).
  // IMPORTANTE: await (não fire-and-forget). No Vercel a function congela ao
  // responder; se a chamada for solta, o sync com a AC morre no meio e o lead
  // nunca entra. A emissão já tem espera perceptível — ~200–800ms a mais ok.
  try {
    const r = await tagContactByEmail(lead.email, process.env.AC_CHECKIN_TAG_ID, {
      name: lead.name,
      phone: lead.phone,
    });
    if (!r.sent) console.warn("[ingresso] AC check-in tag não aplicada:", r.reason);
  } catch (e) {
    console.error("[ingresso] AC check-in tag erro:", e);
  }

  // FR-005: o magic link é devolvido aqui para exibição na MESMA sessão.
  return NextResponse.json({
    leadId: lead.id,
    isNew,
    magicLink,
    ticket,
  });
}
