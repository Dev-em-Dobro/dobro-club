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

// Mantido em sincronia com o SCHEMA de lib/db.ts (fonte de verdade do app Next).
// Os scripts Node (db:init, seed, configure-ac) não conseguem importar o .ts,
// então o schema é espelhado aqui para `npm run db:init` criar as tabelas certas
// (com onboarding_channel, content_items, engagement_events, lives). Ao mexer no
// schema, atualize OS DOIS arquivos.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY, slug text NOT NULL, name text, status text,
  api_key_hash text NOT NULL, webhook_url text, created_at timestamptz,
  week_starts_at timestamptz, onboarding_channel text
);
CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY, event_id text NOT NULL, name text, email text, phone text,
  token text NOT NULL UNIQUE, source text, revoked boolean NOT NULL,
  created_at timestamptz, last_seen_at timestamptz,
  photo_url text, referrer_lead_id text
);
CREATE TABLE IF NOT EXISTS engagement_events (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  lead_id text,
  type text NOT NULL,
  data jsonb,
  created_at timestamptz
);
CREATE TABLE IF NOT EXISTS content_items (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  resource text,
  is_gift boolean NOT NULL,
  release_at timestamptz,
  position int,
  created_at timestamptz,
  release_offset_days int,
  is_free boolean
);
CREATE TABLE IF NOT EXISTS lives (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  title text NOT NULL,
  description text,
  starts_at timestamptz,
  duration_min int,
  stream_url text,
  recording_url text,
  position int,
  created_at timestamptz
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer_lead_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS week_starts_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS onboarding_channel text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS release_offset_days int;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_free boolean;
CREATE INDEX IF NOT EXISTS idx_leads_event ON leads(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_email ON leads (event_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_phone ON leads (event_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engevents_event ON engagement_events(event_id);
CREATE INDEX IF NOT EXISTS idx_engevents_lead  ON engagement_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_engevents_type  ON engagement_events(event_id, type);
CREATE INDEX IF NOT EXISTS idx_content_event ON content_items(event_id);
CREATE INDEX IF NOT EXISTS idx_content_event_kind ON content_items(event_id, kind);
CREATE INDEX IF NOT EXISTS idx_lives_event ON lives(event_id);
`;

export async function initSchema() {
  // Run each statement individually so statements pg-mem does not support
  // (partial unique indexes, ADD COLUMN IF NOT EXISTS) do not abort table creation.
  const stmts = SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    const isSkippable =
      /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt) ||
      /^\s*ALTER\s+TABLE/i.test(stmt);
    if (isSkippable) {
      try {
        await query(stmt);
      } catch (e) {
        console.warn(`[db] initSchema: statement skipped — ${e.message.split('\n')[0]}`);
      }
    } else {
      await query(stmt);
    }
  }
}
