import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { getEvent, isTicketOnly } from "@/lib/events";
import { buildMagicLink } from "@/lib/auth/token";

export async function GET(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  if (!sess) return NextResponse.json({ error: "sem sessão" }, { status: 401 });
  const lead = await getLeadById(sess.eventId, sess.leadId);
  if (!lead || lead.revoked) {
    return NextResponse.json({ error: "sem sessão" }, { status: 401 });
  }
  // Defesa em profundidade: nenhuma rota cria sessão para evento "só ingresso",
  // mas se um cookie desses aparecer (resquício, forja), ele não vale — e o
  // magic link do lead, que esta rota devolveria, jamais é entregue.
  if (isTicketOnly(await getEvent(lead.eventId))) {
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
