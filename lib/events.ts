import crypto from "node:crypto";
import { query } from "./db";

export interface EventRow {
  id: string;
  slug: string;
  name: string | null;
  status: string | null;
  apiKeyHash: string | null;
  webhookUrl: string | null;
  /** Início da semana do evento; base da janela de ingresso (T-3 dias). `null` ⇒ sem data marcada. */
  weekStartsAt: string | null;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

const SELECT_EVENT = `SELECT id, slug, name, status,
        api_key_hash AS "apiKeyHash", webhook_url AS "webhookUrl",
        week_starts_at AS "weekStartsAt"
   FROM events`;

export async function getEvent(eventId: string): Promise<EventRow | null> {
  const { rows } = await query<EventRow>(`${SELECT_EVENT} WHERE id = $1`, [
    eventId,
  ]);
  return rows[0] || null;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const { rows } = await query<EventRow>(`${SELECT_EVENT} WHERE slug = $1`, [
    slug,
  ]);
  return rows[0] || null;
}

export function verifyApiKey(
  event: EventRow | null,
  key: string | null | undefined,
): boolean {
  if (!event || !key) return false;
  const a = Buffer.from(hashApiKey(key));
  const b = Buffer.from(event.apiKeyHash || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
