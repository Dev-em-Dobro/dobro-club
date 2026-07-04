import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { getLeadGamification } from "@/lib/gamification";

/**
 * Streak + badges do PRÓPRIO lead (Story 8.19) — participante, sessão `dc_session`.
 * Derivado dos engagement_events + lead score (8.18); read-only.
 */
export async function GET(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const lead = await getLeadById(sess.eventId, sess.leadId);
  if (!lead || lead.revoked) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await getLeadGamification(lead.eventId, lead.id);
  return NextResponse.json(data);
}
