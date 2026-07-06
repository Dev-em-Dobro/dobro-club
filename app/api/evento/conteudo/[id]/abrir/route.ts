import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { getEventBySlug } from "@/lib/events";
import { emit, hasCompletedSurvey } from "@/lib/engagement";
import { getContentItem, isItemReleasedForLead, releaseForLeadAt } from "@/lib/content";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

/**
 * Abre um item de conteúdo dia-1 (Story 8.14): revalida gate + liberação **no
 * servidor**, mede o acesso (`content.opened`) e só então devolve o `resource`.
 * Item `isFree` (ex.: a introdução): aberto a todos — dispensa sessão, pesquisa
 * e liberação (a introdução não trava). Item travado mantém o gate completo.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  const lead = sess ? await getLeadById(sess.eventId, sess.leadId) : null;
  const authenticated = !!lead && !lead.revoked;

  // Logado usa o evento do lead; visitante usa o evento configurado (por slug).
  const eventId = authenticated
    ? lead!.eventId
    : (await getEventBySlug(DEFAULT_SLUG))?.id;
  if (!eventId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const item = await getContentItem(eventId, id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Conteúdo aberto: sem gate. Mede (com lead, se houver) e entrega na hora.
  if (item.isFree) {
    await emit(eventId, authenticated ? lead!.id : null, "content.opened", {
      kind: item.kind,
      itemId: item.id,
    });
    return NextResponse.json({ kind: item.kind, resource: item.resource });
  }

  // Conteúdo travado: exige sessão (Mestre) + pesquisa + liberação.
  if (!authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await hasCompletedSurvey(lead!.id))) {
    return NextResponse.json({ error: "gated" }, { status: 403 });
  }
  // Story 8.16: aula libera por-lead (entrada + offset); demais kinds por calendário.
  if (!isItemReleasedForLead(item, lead!.createdAt)) {
    return NextResponse.json(
      {
        error: "not_released",
        releaseAt: item.releaseAt,
        releaseForLeadAt: releaseForLeadAt(item, lead!.createdAt),
      },
      { status: 403 },
    );
  }

  await emit(eventId, lead!.id, "content.opened", {
    kind: item.kind,
    itemId: item.id,
  });

  return NextResponse.json({
    kind: item.kind,
    resource: item.resource,
  });
}
