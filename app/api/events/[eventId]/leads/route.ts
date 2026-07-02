import { NextResponse, type NextRequest } from "next/server";
import { getEvent, verifyApiKey } from "@/lib/events";
import { validateLeadInput } from "@/lib/validate";
import { createOrGetLead } from "@/lib/leads";
import { buildMagicLink } from "@/lib/auth/token";
import { sendMagicLinkEmail } from "@/lib/email";
import { fireInscriptionWebhook } from "@/lib/webhook";

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

  const body = await req.json().catch(() => ({}));
  const { ok, errors, value } = validateLeadInput(body);
  if (!ok) return NextResponse.json({ errors }, { status: 400 });

  const { lead, isNew } = await createOrGetLead(event.id, value);
  const magicLink = buildMagicLink(lead.token);
  if (isNew) {
    sendMagicLinkEmail({
      to: lead.email,
      name: lead.name,
      eventName: event.name,
      magicLink,
    })
      .then((r) => {
        if (!r.sent) console.warn("magic-link email not sent:", r.reason);
      })
      .catch((e) => console.error("magic-link email error:", e));
    fireInscriptionWebhook(event, lead, magicLink)
      .then((r) => {
        if (!r.sent) console.warn("inscription webhook not sent:", r.reason);
      })
      .catch((e) => console.error("inscription webhook error:", e));
  }
  return NextResponse.json({ leadId: lead.id, magicLink, isNew });
}
