import { NextResponse, type NextRequest } from "next/server";
import { getLeadByToken, touchLastSeen } from "@/lib/leads";
import { getEvent, isTicketOnly } from "@/lib/events";
import {
  signSession,
  COOKIE,
  COOKIE_MAX_AGE,
} from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const lead = await getLeadByToken(token);
  if (!lead || lead.revoked) {
    return NextResponse.redirect(new URL("/link-invalido", req.url), 302);
  }
  const event = await getEvent(lead.eventId);

  // Evento "só ingresso": o lead tem token no banco (todo lead tem), mas ele não
  // vale como entrada — nesse evento não existe plataforma para entrar. Sem
  // cookie: devolve a pessoa ao único lugar que é dela, o gerador de ingresso.
  if (isTicketOnly(event)) {
    return NextResponse.redirect(
      new URL(`/e/${event!.slug}/ingresso`, req.url),
      302,
    );
  }

  await touchLastSeen(lead.eventId, lead.id);

  const res = NextResponse.redirect(
    new URL(`/e/${event?.slug || lead.eventId}`, req.url),
    302,
  );
  res.cookies.set(COOKIE, signSession({ leadId: lead.id, eventId: lead.eventId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: Math.floor(COOKIE_MAX_AGE / 1000),
    path: "/",
  });
  return res;
}
