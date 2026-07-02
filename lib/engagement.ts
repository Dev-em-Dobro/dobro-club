import { query } from "./db";
import { newId } from "./leads";
import { getEvent, type EventRow } from "./events";
import { fireEngagementWebhook } from "./webhook";

/** Taxonomia FROZEN (CONTRIBUTING §3). */
export type EngagementType =
  | "survey.completed"
  | "lesson.started"
  | "lesson.completed"
  | "ticket.shared"
  | "referral.signup";

/**
 * Emissor compartilhado de eventos de engajamento.
 * Persiste em `engagement_events` e dispara o webhook de saída best-effort
 * (nunca bloqueia nem propaga erro para a resposta HTTP).
 *
 * O único acoplamento permitido entre features é este contrato (Constituição IV).
 */
export async function emit(
  eventId: string,
  leadId: string | null,
  type: EngagementType,
  data: unknown,
): Promise<void> {
  await query(
    `INSERT INTO engagement_events (id, event_id, lead_id, type, data, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      newId("engev"),
      eventId,
      leadId,
      type,
      data === undefined ? null : JSON.stringify(data),
      new Date().toISOString(),
    ],
  );

  // Webhook best-effort: resolve o evento e dispara sem bloquear a resposta.
  void resolveAndFire(eventId, leadId, type, data);
}

async function resolveAndFire(
  eventId: string,
  leadId: string | null,
  type: string,
  data: unknown,
): Promise<void> {
  try {
    const event: EventRow | null = await getEvent(eventId);
    if (!event?.webhookUrl) return;
    const r = await fireEngagementWebhook(event, leadId, type, data);
    if (!r.sent) console.warn(`[engagement] webhook not sent (${type}):`, r.reason);
  } catch (e) {
    console.error(`[engagement] webhook error (${type}):`, e);
  }
}
