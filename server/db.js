import pg from 'pg';
const { Pool } = pg;

let pool = null;

function buildPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
      ? { rejectUnauthorized: false }
      : false
  });
}

export function getPool() {
  if (!pool) pool = buildPool();
  return pool;
}

// Tests inject a pg-mem pool here before any query runs.
export function setPool(p) { pool = p; }

export function query(text, params) {
  return getPool().query(text, params);
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY, slug text NOT NULL, name text, status text,
  api_key_hash text NOT NULL, webhook_url text, created_at timestamptz
);
CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY, event_id text NOT NULL, name text, email text, phone text,
  token text NOT NULL UNIQUE, source text, revoked boolean NOT NULL,
  created_at timestamptz, last_seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_leads_event ON leads(event_id);
`;

export async function initSchema() {
  await query(SCHEMA);
}
