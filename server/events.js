import crypto from 'node:crypto';
import { readJson } from './data/store.js';

export function hashApiKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

export async function getEvent(eventId) {
  return readJson(`events/${eventId}.json`);
}

export function verifyApiKey(event, key) {
  if (!event || !key) return false;
  const a = Buffer.from(hashApiKey(key));
  const b = Buffer.from(event.apiKeyHash || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
