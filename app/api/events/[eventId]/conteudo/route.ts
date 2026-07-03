import { NextResponse, type NextRequest } from "next/server";
import { getEvent, verifyApiKey } from "@/lib/events";
import {
  createContentItem,
  ContentValidationError,
  type ContentInput,
} from "@/lib/content";

/**
 * Provisionamento de conteúdo dia-1 (Story 8.14) — rota admin `X-Api-Key`, sem
 * interface de admin nesta story (como 8.4; admin UI é 8.9).
 */
export async function POST(
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

  const body = (await req.json().catch(() => ({}))) as ContentInput;
  try {
    const item = await createContentItem(event.id, body);
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (e) {
    if (e instanceof ContentValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
