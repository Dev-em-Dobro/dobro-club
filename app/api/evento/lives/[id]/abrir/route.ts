import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { emit, hasCompletedSurvey } from "@/lib/engagement";
import { getLive, liveState, isWatchable, watchResource } from "@/lib/lives";

/**
 * Abre uma live de aquecimento (Story 8.17): revalida gate + estado assistível
 * **no servidor**, mede o acesso (`live.opened` com `{liveId, state}`) e só então
 * devolve o `resource` (transmissão ao vivo ou gravação) — embed dentro da
 * plataforma (Const. III), `external:false`.
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

  const live = await getLive(lead.eventId, id);
  if (!live) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!(await hasCompletedSurvey(lead.id))) {
    return NextResponse.json({ error: "gated" }, { status: 403 });
  }

  const state = liveState(live);
  if (!isWatchable(state)) {
    return NextResponse.json({ error: "not_watchable", state }, { status: 403 });
  }

  await emit(lead.eventId, lead.id, "live.opened", { liveId: live.id, state });

  return NextResponse.json({
    state,
    resource: watchResource(live, state),
    external: false,
  });
}
