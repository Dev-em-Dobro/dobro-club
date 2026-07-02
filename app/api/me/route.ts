import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";

export async function GET(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  if (!sess) return NextResponse.json({ error: "sem sessão" }, { status: 401 });
  const lead = await getLeadById(sess.eventId, sess.leadId);
  if (!lead || lead.revoked) {
    return NextResponse.json({ error: "sem sessão" }, { status: 401 });
  }
  return NextResponse.json({
    leadId: lead.id,
    name: lead.name,
    eventId: lead.eventId,
  });
}
