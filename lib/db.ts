import pg from "pg";

const { Pool } = pg;

// Cache do pool em globalThis. No dev do Next, cada Route Handler é um bundle
// separado com a SUA PRÓPRIA cópia deste módulo — sem isso, cada rota subiria um
// pg-mem isolado e o lead criado na captação "sumiria" na hora de validar o
// magic link (`/entrar/[token]`). globalThis é único por processo, então todas
// as rotas (e os hot-reloads) compartilham o MESMO banco.
const globalForDb = globalThis as unknown as {
  __dobroPool?: pg.Pool | null;
  __dobroPoolPromise?: Promise<pg.Pool> | null;
};

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

/**
 * Fallback de desenvolvimento: sem `DATABASE_URL` (e fora de produção), sobe um
 * Postgres em memória (pg-mem) já com o evento demo semeado, para o fluxo de
 * ingresso rodar sem banco externo. Dados NÃO persistem entre reinícios.
 */
async function createPool(): Promise<pg.Pool> {
  const devFallback =
    !process.env.DATABASE_URL && process.env.NODE_ENV !== "production";

  if (devFallback) {
    // pg-mem é externo (serverExternalPackages) — só carregado neste caminho dev.
    const { newDb } = await import("pg-mem");
    const mem = newDb();
    const { Pool: MemPool } = mem.adapters.createPg();
    // set antes do seed p/ query() achar o pool (via ensurePool)
    globalForDb.__dobroPool = new MemPool() as unknown as pg.Pool;
    await initSchema();
    await seedDemoEvent();
    console.warn(
      "[db] DATABASE_URL ausente — usando Postgres em memória (dev). Dados não persistem entre reinícios.",
    );
    return globalForDb.__dobroPool;
  }

  return buildPool();
}

/** Garante um pool pronto (com fallback dev) antes de qualquer query. */
export async function ensurePool(): Promise<pg.Pool> {
  if (globalForDb.__dobroPool) return globalForDb.__dobroPool;
  if (!globalForDb.__dobroPoolPromise) globalForDb.__dobroPoolPromise = createPool();
  globalForDb.__dobroPool = await globalForDb.__dobroPoolPromise;
  return globalForDb.__dobroPool;
}

export function getPool(): pg.Pool {
  if (!globalForDb.__dobroPool) globalForDb.__dobroPool = buildPool();
  return globalForDb.__dobroPool;
}

/** Tests inject a pg-mem pool here before any query runs. */
export function setPool(p: pg.Pool | null): void {
  globalForDb.__dobroPool = p;
  globalForDb.__dobroPoolPromise = null;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const p = await ensurePool();
  return p.query<T>(text, params as never[]);
}

/** Semeia um evento ativo para o fluxo de ingresso funcionar no fallback dev. */
async function seedDemoEvent(): Promise<void> {
  const slug = process.env.NEXT_PUBLIC_EVENT_SLUG || "piloto";
  const { rows } = await query("SELECT id FROM events WHERE slug = $1", [slug]);
  if (rows[0]) return;
  await query(
    `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      "evt_demo",
      slug,
      "Semana do Zero ao Programador Contratado",
      "active",
      "dev-fallback",
      null,
      new Date().toISOString(),
    ],
  );
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
