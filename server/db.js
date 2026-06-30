import pg from 'pg';
const { Pool } = pg;

let pool = null;

function buildPool() {
  const sslCert = process.env.NEON_CA_CERT;
  let ssl;
  if (sslCert) {
    ssl = { rejectUnauthorized: true, ca: sslCert };
  } else if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')) {
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = false;
  }
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_email ON leads (event_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_phone ON leads (event_id, phone) WHERE phone IS NOT NULL;
`;

export async function initSchema() {
  // Run each statement individually so index creation failures (e.g. pg-mem
  // does not support partial unique indexes) do not abort table creation.
  const stmts = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    const isIndex = /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt);
    if (isIndex) {
      try {
        await query(stmt);
      } catch (e) {
        console.warn(`[db] initSchema: index skipped — ${e.message.split('\n')[0]}`);
      }
    } else {
      await query(stmt);
    }
  }
}
