import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { getEventBySlug } from "@/lib/events";
import { hasCompletedSurvey } from "@/lib/engagement";
import { listContentItems, isItemReleasedForLead, releaseForLeadAt } from "@/lib/content";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

/**
 * Lista o conteúdo dia-1 (Story 8.14). É **público**: qualquer visitante pode
 * navegar a lista, mas os itens vêm travados até (1) passar pelo Mestre — ter
 * sessão (`authenticated`) — e (2) responder a pesquisa (`surveyAnswered`).
 * O `resource` **nunca** é listado aqui; só é revelado pelo `abrir`.
 */
export async function GET(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  const lead = sess ? await getLeadById(sess.eventId, sess.leadId) : null;
  const authenticated = !!lead && !lead.revoked;

  // Logado usa o evento do lead; visitante usa o evento configurado (por slug).
  const eventId = authenticated
    ? lead!.eventId
    : (await getEventBySlug(DEFAULT_SLUG))?.id;
  if (!eventId) {
    return NextResponse.json({ authenticated, surveyAnswered: false, items: [] });
  }

  const surveyAnswered = authenticated
    ? await hasCompletedSurvey(lead!.id)
    : false;
  const now = new Date();
  // Story 8.16: aulas liberam por-lead (entrada + offset); demais kinds seguem o
  // calendário da 8.14. `releaseForLeadAt` alimenta o rótulo "em breve" por lead.
  const entryDate = authenticated ? lead!.createdAt : null;
  const items = (await listContentItems(eventId)).map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    description: item.description,
    isGift: item.isGift,
    releaseAt: item.releaseAt,
    releaseOffsetDays: item.releaseOffsetDays,
    isFree: item.isFree,
    releaseForLeadAt: authenticated ? releaseForLeadAt(item, entryDate, now) : null,
    available:
      item.isFree ||
      (authenticated && surveyAnswered && isItemReleasedForLead(item, entryDate, now)),
  }));

  return NextResponse.json({ authenticated, surveyAnswered, items });
}
