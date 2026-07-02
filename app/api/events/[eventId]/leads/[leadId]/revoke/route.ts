import { NextResponse, type NextRequest } from "next/server";
import { getEvent, verifyApiKey } from "@/lib/events";
import { setRevoked } from "@/lib/leads";

export async function POST(
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
  const ok = await setRevoked(event.id, leadId, true);
  if (!ok) {
    return NextResponse.json({ error: "lead não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ leadId, revoked: true });
}
