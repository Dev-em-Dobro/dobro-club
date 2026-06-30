import crypto from 'node:crypto';
import { query } from './db.js';

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

export async function getEvent(eventId) {
  const { rows } = await query(
    `SELECT id, slug, name, status,
            api_key_hash AS "apiKeyHash", webhook_url AS "webhookUrl"
     FROM events WHERE id = $1`,
    [eventId]
  );
  return rows[0] || null;
}

export function verifyApiKey(event, key) {
  if (!event || !key) return false;
  const a = Buffer.from(hashApiKey(key));
  const b = Buffer.from(event.apiKeyHash || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
