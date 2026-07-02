import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";

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
    // O dono, já autenticado, pode ver o próprio link p/ guardar/recuperar.
    magicLink: buildMagicLink(lead.token),
  });
}
