import type { EventRow } from "./events";
import type { Lead } from "./leads";

interface FireResult {
  sent: boolean;
  reason?: string;
}

async function postWithRetry(url: string, payload: unknown): Promise<FireResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (res.ok) return { sent: true };
    } catch {
      // retry once
    } finally {
      clearTimeout(timer);
    }
  }
  return { sent: false, reason: "failed" };
}

/** Webhook de inscrição (porte da 8.1). */
export async function fireInscriptionWebhook(
  event: Pick<EventRow, "id" | "slug" | "webhookUrl">,
  lead: Lead,
  magicLink: string,
): Promise<FireResult> {
  if (!event?.webhookUrl) return { sent: false, reason: "no-url" };
  return postWithRetry(event.webhookUrl, {
    type: "lead.created",
    event: { id: event.id, slug: event.slug },
    lead: { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone },
    magicLink,
  });
}

/** Webhook de saída para eventos de engajamento (contrato §3). */
export async function fireEngagementWebhook(
  event: Pick<EventRow, "id" | "slug" | "webhookUrl">,
  leadId: string | null,
  type: string,
  data: unknown,
): Promise<FireResult> {
  if (!event?.webhookUrl) return { sent: false, reason: "no-url" };
  return postWithRetry(event.webhookUrl, {
    type,
    event: { id: event.id, slug: event.slug },
    lead: { id: leadId },
    data,
  });
}
