import { NextResponse, type NextRequest } from "next/server";
import { getEvent, verifyApiKey } from "@/lib/events";
import { getLeadGamification } from "@/lib/gamification";

/**
 * Streak + badges de um lead (Story 8.19) — rota admin/consumo `X-Api-Key`,
 * read-only. Derivado dos engagement_events + lead score (8.18).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ eventId: string; leadId: string }> },
) {
  const { eventId, leadId } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) {
    return NextResponse.json({ error: "id de evento inválido" }, { status: 400 });
  }
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });
  }
  if (!verifyApiKey(event, req.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "api key inválida" }, { status: 401 });
  }

  const data = await getLeadGamification(event.id, leadId);
  return NextResponse.json(data);
}
