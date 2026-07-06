import { NextResponse, type NextRequest } from "next/server";
import { verifySession, COOKIE } from "@/lib/auth/session";
import { getLeadById } from "@/lib/leads";
import { getEventBySlug } from "@/lib/events";
import { hasCompletedSurvey } from "@/lib/engagement";
import { listLives, liveState, isWatchable } from "@/lib/lives";

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";

/**
 * Agenda de lives de aquecimento (Story 8.17). Pública: o visitante navega a
 * agenda, mas só assiste com sessão (`authenticated`) + pesquisa (`surveyAnswered`)
 * e no estado assistível. `streamUrl`/`recordingUrl` **nunca** são listados aqui;
 * o embed só é revelado pelo `abrir`.
 */
export async function GET(req: NextRequest) {
  const sess = verifySession(req.cookies.get(COOKIE)?.value);
  const lead = sess ? await getLeadById(sess.eventId, sess.leadId) : null;
  const authenticated = !!lead && !lead.revoked;

  const eventId = authenticated
    ? lead!.eventId
    : (await getEventBySlug(DEFAULT_SLUG))?.id;
  if (!eventId) {
    return NextResponse.json({ authenticated, surveyAnswered: false, lives: [] });
  }

  const surveyAnswered = authenticated ? await hasCompletedSurvey(lead!.id) : false;
  const now = new Date();
  const lives = (await listLives(eventId)).map((live) => {
    const state = liveState(live, now);
    return {
      id: live.id,
      title: live.title,
      description: live.description,
      startsAt: live.startsAt,
      durationMin: live.durationMin,
      state,
      watchable: authenticated && surveyAnswered && isWatchable(state),
      hasRecording: !!live.recordingUrl,
    };
  });

  return NextResponse.json({ authenticated, surveyAnswered, lives });
}
