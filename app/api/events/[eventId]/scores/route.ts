import { NextResponse, type NextRequest } from "next/server";
import { getEvent, verifyApiKey } from "@/lib/events";
import { listEventScores } from "@/lib/score";

/**
 * Ranking dos leads de um evento por score de engajamento (Story 8.18) — rota
 * admin/consumo `X-Api-Key`, read-only. Ordenado por score desc (desempate por
 * leadId asc). Derivado dos engagement_events na leitura.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;
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

  const scores = await listEventScores(event.id);
  return NextResponse.json({ scores });
}
