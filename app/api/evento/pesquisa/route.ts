import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { emit, hasCompletedSurvey } from "@/lib/engagement";

/**
 * Pesquisa rápida (placeholder da Story 8.2 no Next). Marca a pesquisa como
 * respondida para o lead da sessão (emite `survey.completed`), satisfazendo o
 * gate do conteúdo. Quando o embed real da pesquisa (8.2) entrar, ele passa a
 * emitir `survey.completed` no lugar deste placeholder.
 */
export async function POST(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const lead = await getLeadById(sess.eventId, sess.leadId);
  if (!lead || lead.revoked) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!(await hasCompletedSurvey(lead.id))) {
    await emit(lead.eventId, lead.id, "survey.completed", { via: "placeholder" });
  }
  return NextResponse.json({ ok: true });
}
