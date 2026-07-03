import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { getEvent } from "@/lib/events";
import {
  buildTicket,
  ingressoPhase,
  ingressoWindowOpensAt,
} from "@/lib/ingresso";
import { emit, hasCompletedSurvey } from "@/lib/engagement";

/**
 * Hub do evento (Story 8.12). Estado de pré-evento para o lead da sessão:
 * credencial provisória (ou ingresso oficial após a janela T-3), quando o
 * ingresso abre, e se o gate da pesquisa (8.2) está satisfeito.
 *
 * A credencial NÃO é entidade nova — é o ticket derivado da 8.3 (`buildTicket`)
 * apresentado conforme o `phase` calculado por tempo.
 */
export async function GET(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const lead = await getLeadById(sess.eventId, sess.leadId);
  if (!lead || lead.revoked) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const event = await getEvent(lead.eventId);
  if (!event) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const phase = ingressoPhase(event);
  const windowOpensAt = ingressoWindowOpensAt(event);
  const surveyAnswered = await hasCompletedSurvey(lead.id);

  // Tudo é mensurado (Constituição IV): persiste o acesso e dispara webhook
  // best-effort dentro de emit(). Não bloqueia a resposta.
  await emit(lead.eventId, lead.id, "hub.viewed", { phase });

  return NextResponse.json({
    lead: { id: lead.id, name: lead.name, eventId: lead.eventId },
    phase,
    ticket: buildTicket(lead),
    windowOpensAt: windowOpensAt ? windowOpensAt.toISOString() : null,
    surveyAnswered,
  });
}
