import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { emit, hasCompletedSurvey } from "@/lib/engagement";
import { getContentItem, isReleased } from "@/lib/content";

/**
 * Abre um item de conteúdo dia-1 (Story 8.14): revalida gate + liberação **no
 * servidor**, mede o acesso (`content.opened`) e só então devolve o `resource`.
 * Para `kind='codequest'` marca `external: true` (o front abre em nova aba) —
 * exceção justificada à Constituição III (ver plan §Complexity).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const lead = await getLeadById(sess.eventId, sess.leadId);
  if (!lead || lead.revoked) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const item = await getContentItem(lead.eventId, id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await hasCompletedSurvey(lead.id))) {
    return NextResponse.json({ error: "gated" }, { status: 403 });
  }
  if (!isReleased(item)) {
    return NextResponse.json(
      { error: "not_released", releaseAt: item.releaseAt },
      { status: 403 },
    );
  }

  await emit(lead.eventId, lead.id, "content.opened", {
    kind: item.kind,
    itemId: item.id,
  });

  return NextResponse.json({
    kind: item.kind,
    resource: item.resource,
    external: item.kind === "codequest",
  });
}
