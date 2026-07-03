import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { validateLeadInput } from "@/lib/validate";
import { createOrGetLead } from "@/lib/leads";
import {
  signSession,
  COOKIE,
  COOKIE_MAX_AGE,
} from "@/lib/auth/session";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

/**
 * Mestre do Evento — captação de dados (Story 8.13). Recebe nome/e-mail/WhatsApp,
 * cria (ou reaproveita) o lead e **já loga** a sessão (`dc_session`), para o
 * participante voltar ao conteúdo desbloqueado. Não gera ingresso visual (isso é
 * a 8.3); aqui é captação pura, como a lista de espera do evento.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = typeof body.slug === "string" ? body.slug : DEFAULT_SLUG;

  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });
  }

  const { ok, errors, value } = validateLeadInput(body);
  // O Mestre exige os três campos (captação completa).
  if (!ok || !value.name || !value.email || !value.phone) {
    return NextResponse.json(
      { errors: ok ? ["nome, e-mail e WhatsApp são obrigatórios"] : errors },
      { status: 400 },
    );
  }

  const { lead } = await createOrGetLead(event.id, value);

  const res = NextResponse.json({ ok: true, leadId: lead.id });
  res.cookies.set(COOKIE, signSession({ leadId: lead.id, eventId: event.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(COOKIE_MAX_AGE / 1000),
    path: "/",
  });
  return res;
}
