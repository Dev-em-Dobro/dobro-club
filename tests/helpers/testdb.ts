import { newDb } from "pg-mem";
import { setPool, initSchema, query } from "@/lib/db";
import { hashApiKey } from "@/lib/events";

// Postgres em memória a cada chamada; injeta no pool de lib/db.ts.
export async function useTestDb() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  setPool(new Pool());
  await initSchema();
  return mem;
}

export interface SeedEventOptions {
  id?: string;
  slug?: string;
  name?: string;
  status?: string;
  apiKey?: string;
  webhookUrl?: string | null;
  /** ISO string do início da semana do evento; `null`/ausente ⇒ sem data marcada. */
  weekStartsAt?: string | null;
}

export async function seedEvent(overrides: SeedEventOptions = {}) {
  const ev = {
    id: "evt_test",
    slug: "piloto",
    name: "Piloto",
    status: "active",
    apiKey: "k",
    webhookUrl: null as string | null,
    weekStartsAt: null as string | null,
    ...overrides,
  };
  await query(
    `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at, week_starts_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      ev.id,
      ev.slug,
      ev.name,
      ev.status,
      hashApiKey(ev.apiKey),
      ev.webhookUrl,
      new Date().toISOString(),
      ev.weekStartsAt,
    ],
  );
  return ev;
}
