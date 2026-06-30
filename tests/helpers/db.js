import { newDb } from 'pg-mem';
import { setPool, initSchema } from '../../server/db.js';

// Fresh in-memory Postgres per call; wires it into server/db.js.
export async function useTestDb() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  setPool(new Pool());
  await initSchema();
  return mem;
}

export async function seedEvent(overrides = {}) {
  const { query } = await import('../../server/db.js');
  const { hashApiKey } = await import('../../server/events.js');
  const ev = { id: 'evt_test', slug: 'piloto', name: 'Piloto', status: 'active', apiKey: 'k', webhookUrl: null, ...overrides };
  await query(
    `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [ev.id, ev.slug, ev.name, ev.status, hashApiKey(ev.apiKey), ev.webhookUrl, new Date().toISOString()]
  );
  return ev;
}
