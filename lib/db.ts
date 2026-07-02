import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function buildPool(): pg.Pool {
  const sslCert = process.env.NEON_CA_CERT;
  let ssl: pg.PoolConfig["ssl"];
  if (sslCert) {
    ssl = { rejectUnauthorized: true, ca: sslCert };
  } else if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes("localhost")
  ) {
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = false;
  }
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
}

export function getPool(): pg.Pool {
  if (!pool) pool = buildPool();
  return pool;
}

/** Tests inject a pg-mem pool here before any query runs. */
export function setPool(p: pg.Pool | null): void {
  pool = p;
}

export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY, slug text NOT NULL, name text, status text,
  api_key_hash text NOT NULL, webhook_url text, created_at timestamptz
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
ALTER TABLE leads ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer_lead_id text;
CREATE INDEX IF NOT EXISTS idx_leads_event ON leads(event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_email ON leads (event_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_event_phone ON leads (event_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engevents_event ON engagement_events(event_id);
CREATE INDEX IF NOT EXISTS idx_engevents_lead  ON engagement_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_engevents_type  ON engagement_events(event_id, type);
`;

export async function initSchema(): Promise<void> {
  // Run each statement individually so failures pg-mem does not support
  // (partial unique indexes, ADD COLUMN IF NOT EXISTS) do not abort table creation.
  const stmts = SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of stmts) {
    const isSkippable =
      /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(stmt) ||
      /^\s*ALTER\s+TABLE/i.test(stmt);
    if (isSkippable) {
      try {
        await query(stmt);
      } catch (e) {
        console.warn(
          `[db] initSchema: statement skipped — ${(e as Error).message.split("\n")[0]}`,
        );
      }
    } else {
      await query(stmt);
    }
  }
}
