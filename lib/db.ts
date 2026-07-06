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
    await seedDemoContent();
    await seedDevPreviewLead();
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

/**
 * Semeia conteúdo dia-1 (Story 8.14) no fallback dev: as aulas de aquecimento,
 * sem data de liberação (liberadas ao passar o gate da pesquisa). O embed
 * (`resource`) ainda está vazio — preencher quando cada aula tiver o vídeo.
 * Substituir/expandir depois via ingestão admin
 * (`POST /api/events/[eventId]/conteudo`). Dados NÃO persistem entre reinícios.
 */
async function seedDemoContent(): Promise<void> {
  const { rows } = await query(
    "SELECT id FROM content_items WHERE event_id = $1 LIMIT 1",
    ["evt_demo"],
  );
  if (rows[0]) return;
  // `resource` vazio = embed a definir (o botão "Assistir" fica inerte até lá).
  const lessons = [
    {
      id: "cont_intro",
      title: "Introdução — como usar bem a plataforma",
      description: "Comece por aqui: como aproveitar ao máximo a plataforma e o evento.",
      gift: false,
      free: true, // aberta: sem gate do Mestre/pesquisa (a introdução não trava).
    },
    {
      id: "cont_vscode",
      title: "VSCode para iniciantes",
      description: "Instale e configure o VSCode do zero para começar a programar.",
      gift: false,
      free: false,
    },
    {
      id: "cont_github",
      title: "Presente do GitHub",
      description: "Como resgatar e usar o presente do GitHub.",
      gift: true,
      free: false,
    },
  ];
  let position = 1;
  for (const l of lessons) {
    await query(
      `INSERT INTO content_items
         (id, event_id, kind, title, description, resource, is_gift, is_free, release_at, position, created_at)
       VALUES ($1,$2,'lesson',$3,$4,$5,$6,$7,NULL,$8,$9)`,
      [
        l.id,
        "evt_demo",
        l.title,
        l.description,
        "",
        l.gift,
        l.free,
        position++,
        new Date().toISOString(),
      ],
    );
  }
  // Presente inicial (Story 8.13/8.14): doc com is_gift. Servido de /public.
  await query(
    `INSERT INTO content_items
       (id, event_id, kind, title, description, resource, is_gift, release_at, position, created_at)
     VALUES ($1,$2,'doc',$3,$4,$5,true,NULL,$6,$7)`,
    [
      "cont_demo_gift_1",
      "evt_demo",
      "Dicionário de Tags HTML",
      "Guia rápido das tags HTML mais usadas (PDF).",
      "/dicionario-tags-html.pdf",
      1,
      new Date().toISOString(),
    ],
  );
}

// Token FIXO do lead de preview no fallback dev: o magic link fica estável entre
// reinícios (`/entrar/dev-preview`), então dá pra guardar/reusar sem caçar o
// console. Só existe no banco em memória (dev); nunca toca produção.
const DEV_PREVIEW_TOKEN = "dev-preview";

/**
 * Atalho de preview no fallback dev (Story 8.14): cria um lead demo **já com a
 * pesquisa respondida** (`survey.completed`), fixa seu token em `DEV_PREVIEW_TOKEN`
 * e imprime o magic link (estável) no console. Abrir o link loga a sessão e
 * libera o gate — permite ver `/evento/conteudo` sem depender da pesquisa (8.2,
 * ainda em Express). Imports dinâmicos evitam ciclo. Só roda no dev sem DB.
 */
async function seedDevPreviewLead(): Promise<void> {
  try {
    const { createOrGetLead } = await import("./leads");
    const { emit } = await import("./engagement");
    const { buildMagicLink } = await import("./auth/token");
    const { lead, isNew } = await createOrGetLead("evt_demo", {
      name: "Dev Preview",
      email: "dev-preview@local",
      phone: null,
    });
    if (isNew) await emit("evt_demo", lead.id, "survey.completed", {});
    // Fixa o token para o link não mudar a cada boot.
    await query("UPDATE leads SET token = $1 WHERE id = $2", [
      DEV_PREVIEW_TOKEN,
      lead.id,
    ]);
    console.warn(
      `[db] dev preview — link ESTÁVEL para ver o conteúdo (gate liberado):\n      ${buildMagicLink(DEV_PREVIEW_TOKEN)}\n      depois vá para /evento/conteudo`,
    );
  } catch (e) {
    console.warn(`[db] seedDevPreviewLead falhou: ${(e as Error).message}`);
  }
}

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
