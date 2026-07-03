import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { validateLeadInput } from "@/lib/validate";
import { createOrGetLead, setPhoto } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { sendMagicLinkEmail } from "@/lib/email";
import { buildTicket } from "@/lib/ingresso";
import { makeLimiter, clientIp } from "@/lib/ratelimit";

// Captação pública: sem X-Api-Key. Protegida por rate limit + validação +
// consentimento (Complexity Tracking do plan.md).
const limiter = makeLimiter({ windowMs: 60_000, max: 60 });

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

  if (isNew) {
    // Foto do participante (já subida ao Cloudinary pelo cliente). Best-effort:
    // ausência/erro segue com avatar padrão (FR-015).
    const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl : null;
    if (photoUrl) {
      await setPhoto(event.id, lead.id, photoUrl);
      lead.photoUrl = photoUrl;
    }
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
    ticket: buildTicket(lead),
  });
}
