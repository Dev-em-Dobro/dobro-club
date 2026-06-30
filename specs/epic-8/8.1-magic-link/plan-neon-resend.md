# Story 8.1 — Neon Postgres + Resend migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the file-based data layer with **Neon Postgres** (driver: `pg`), and deliver the magic link by **e-mail via Resend** (keeping the inscription webhook). Same public behavior; data now in Postgres; tests run offline against `pg-mem`.

**Decisions:** driver `pg` (testable offline with `pg-mem`, connects to Neon pooler over SSL); idempotency enforced in code (portable across pg / pg-mem); token is a **unique column on `leads`** (the separate token index file is gone → removes the old two-write atomicity gap); env loaded via `dotenv`; Resend `from` defaults to `Dobro Club <onboarding@resend.dev>` (test) when `EMAIL_FROM` has no `<email>`; delivery = e-mail **and** webhook.

**Env (in `.env`, gitignored):** `DATABASE_URL` (Neon pooled), `RESEND_API_KEY`, `EMAIL_FROM`, plus existing `DOBRO_*`.

---

## Schema (portable: no DB-side defaults/functions — values set in JS for pg-mem compat)

```sql
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text,
  status text,
  api_key_hash text NOT NULL,
  webhook_url text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS leads (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  name text,
  email text,
  phone text,
  token text NOT NULL UNIQUE,
  source text,
  revoked boolean NOT NULL,
  created_at timestamptz,
  last_seen_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_leads_event ON leads(event_id);
```

---

## File changes
- **Add deps:** `pg`, `resend`, `dotenv` (runtime); `pg-mem` (dev).
- **Create** `server/db.js` (pool + `query` + `setPool` for tests + `SCHEMA`/`initSchema`).
- **Create** `server/email.js` (Resend send + branded HTML).
- **Create** `scripts/db-init.js`; **add** npm scripts `db:init`, and `dotenv` import to `server.js`, `scripts/seed.js`, `scripts/magic-link.js`.
- **Rewrite** `server/events.js`, `server/leads.js` to SQL.
- **Trim** `server/auth/token.js` (drop `addToken`/`lookupToken`; keep `generateToken`/`buildMagicLink`).
- **Remove** `server/data/store.js` + `tests/server/store.test.js`.
- **Wire** `server/app.js` ingestion to send e-mail + webhook (both fire-and-forget).
- **Rewrite tests** to use a `pg-mem` helper.

---

## BLOCK 1 — Infra + data layer + wiring (implementation)

### `server/db.js`
```js
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
```

### `server/events.js`
```js
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
```

### `server/leads.js`
```js
import crypto from 'node:crypto';
import { query } from './db.js';
import { generateToken } from './auth/token.js';

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function mapLead(row) {
  if (!row) return null;
  return {
    id: row.id, eventId: row.event_id, name: row.name, email: row.email, phone: row.phone,
    token: row.token, source: row.source, revoked: row.revoked,
    createdAt: row.created_at, lastSeenAt: row.last_seen_at
  };
}

export async function createOrGetLead(eventId, input) {
  const { rows: existing } = await query(
    `SELECT * FROM leads
     WHERE event_id = $1
       AND ( (email IS NOT NULL AND email = $2) OR (phone IS NOT NULL AND phone = $3) )
     LIMIT 1`,
    [eventId, input.email || null, input.phone || null]
  );
  if (existing[0]) return { lead: mapLead(existing[0]), isNew: false };

  const row = {
    id: newId('lead'), event_id: eventId,
    name: input.name || null, email: input.email || null, phone: input.phone || null,
    token: generateToken(), source: 'captacao-externa', revoked: false,
    created_at: new Date().toISOString(), last_seen_at: null
  };
  const { rows } = await query(
    `INSERT INTO leads (id, event_id, name, email, phone, token, source, revoked, created_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [row.id, row.event_id, row.name, row.email, row.phone, row.token, row.source, row.revoked, row.created_at, row.last_seen_at]
  );
  return { lead: mapLead(rows[0]), isNew: true };
}

export async function getLeadByToken(token) {
  const { rows } = await query('SELECT * FROM leads WHERE token = $1', [token]);
  return mapLead(rows[0]);
}

export async function getLeadById(eventId, leadId) {
  const { rows } = await query('SELECT * FROM leads WHERE event_id = $1 AND id = $2', [eventId, leadId]);
  return mapLead(rows[0]);
}

export async function touchLastSeen(eventId, leadId) {
  await query('UPDATE leads SET last_seen_at = $1 WHERE event_id = $2 AND id = $3',
    [new Date().toISOString(), eventId, leadId]);
}

export async function setRevoked(eventId, leadId, revoked) {
  const { rowCount } = await query('UPDATE leads SET revoked = $1 WHERE event_id = $2 AND id = $3',
    [revoked, eventId, leadId]);
  return rowCount > 0;
}
```

### `server/auth/token.js` (trim)
Keep `generateToken()` and `buildMagicLink(token)` exactly as they are. **Delete** `addToken`, `lookupToken`, and the `INDEX`/store imports.

### `server/email.js`
```js
import { Resend } from 'resend';

let client = null;
function getClient() {
  if (!client && process.env.RESEND_API_KEY) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

function fromAddress() {
  const f = process.env.EMAIL_FROM;
  return f && f.includes('<') ? f : 'Dobro Club <onboarding@resend.dev>';
}

export function magicLinkHtml({ name, eventName, magicLink }) {
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  return `<!doctype html><html><body style="margin:0;background:#030617;font-family:Mulish,Arial,sans-serif;color:#eef8fa;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#0a1020;border:3px solid #983a92;border-radius:8px;padding:28px;text-align:center">
    <p style="font-family:'Press Start 2P',monospace;color:#facc16;font-size:14px;margin:0 0 8px">DOBRO CLUB</p>
    <h1 style="font-size:18px;margin:8px 0">${greeting}</h1>
    <p style="color:#9aa6b8">Seu acesso ${eventName ? `ao <b style="color:#eef8fa">${eventName}</b>` : 'ao evento'} está pronto. É só clicar para entrar — sem senha.</p>
    <a href="${magicLink}" style="display:inline-block;margin:18px 0;padding:14px 26px;background:#facc16;color:#030617;font-weight:800;text-decoration:none;border-radius:6px;box-shadow:0 4px 0 #b77807">Entrar no evento</a>
    <p style="color:#5a6b82;font-size:12px;margin-top:18px">Se o botão não funcionar, cole no navegador:<br>${magicLink}</p>
  </div></body></html>`;
}

export async function sendMagicLinkEmail({ to, name, eventName, magicLink }) {
  const c = getClient();
  if (!c) return { sent: false, reason: 'no-resend-key' };
  if (!to) return { sent: false, reason: 'no-recipient' };
  try {
    const { error } = await c.emails.send({
      from: fromAddress(),
      to,
      subject: 'Seu acesso ao evento — Dobro Club',
      html: magicLinkHtml({ name, eventName, magicLink })
    });
    if (error) return { sent: false, reason: error.message || String(error) };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}
```

### `server/app.js` ingestion wiring
Add `import { sendMagicLinkEmail } from './email.js';`. Replace the `if (isNew) { fireInscriptionWebhook... }` block with both deliveries (fire-and-forget):
```js
    if (isNew) {
      sendMagicLinkEmail({ to: lead.email, name: lead.name, eventName: event.name, magicLink })
        .then((r) => { if (!r.sent) console.warn('magic-link email not sent:', r.reason); })
        .catch((e) => console.error('magic-link email error:', e));
      fireInscriptionWebhook(event, lead, magicLink)
        .then((r) => { if (!r.sent) console.warn('inscription webhook not sent:', r.reason); })
        .catch((e) => console.error('inscription webhook error:', e));
    }
```

### `server.js`
```js
import 'dotenv/config';
import { createApp } from './server/app.js';
import { initSchema } from './server/db.js';

const SECRET = process.env.DOBRO_SESSION_SECRET;
if (process.env.NODE_ENV === 'production' && (!SECRET || SECRET === 'dev-secret-change-me')) {
  throw new Error('DOBRO_SESSION_SECRET must be set to a strong, non-default value in production');
}

await initSchema();

const port = process.env.PORT || 3001;
createApp().listen(port, () => console.log(`Dobro Club API on :${port}`));
```

### `scripts/seed.js` (Postgres upsert)
```js
import 'dotenv/config';
import { query, initSchema } from '../server/db.js';
import { hashApiKey } from '../server/events.js';

await initSchema();
await query(
  `INSERT INTO events (id, slug, name, status, api_key_hash, webhook_url, created_at)
   VALUES ('evt_demo','demo','Demo Dobro Club','active',$1,NULL,$2)
   ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name,
     status = EXCLUDED.status, api_key_hash = EXCLUDED.api_key_hash`,
  [hashApiKey('demo-key'), new Date().toISOString()]
);
console.log('seeded evt_demo (api key: demo-key)');
process.exit(0);
```

### `scripts/magic-link.js`
Add `import 'dotenv/config';` and `import { initSchema } from '../server/db.js';`; call `await initSchema();` before `createOrGetLead`; end with `process.exit(0)`.

### `scripts/db-init.js`
```js
import 'dotenv/config';
import { initSchema } from '../server/db.js';
await initSchema();
console.log('schema ready');
process.exit(0);
```

### `package.json` scripts
Add `"db:init": "node scripts/db-init.js"`. (seed/link unchanged names.)

### Block-1 verification
- [ ] `npm install` the new deps.
- [ ] App boots against real Neon: `npm run db:init` then `npm run seed` then `npm run link -- "Teste" teste@x.com` prints a magic link.
- [ ] Manual Neon smoke: start server, ingest a lead via API, hit `/entrar/:token` (302 → /e/demo + cookie), `/api/me` (200), revoke route (200), `/entrar` again (→ /link-invalido).
- [ ] NOTE: unit/route tests are expected to be RED after this block (they still reference the removed file store) — Block 2 fixes them. State this in the report.

---

## BLOCK 2 — Tests (pg-mem, offline) → green suite

### `tests/helpers/db.js`
```js
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
```

### Test rewrites (each affected file)
Replace the old `beforeEach` (tmp DATA_DIR + `writeJson` fixtures) with:
```js
beforeEach(async () => { await useTestDb(); /* + await seedEvent() where a route test needs an event */ });
```
- **Delete** `tests/server/store.test.js`.
- **`tests/server/token.test.js`** — keep `generateToken` + `buildMagicLink` tests; remove `addToken`/`lookupToken` tests.
- **`tests/server/events.test.js`** — `useTestDb()` + `seedEvent({ id:'evt_1', slug:'piloto', apiKey:'right-key' })`; assert `getEvent`/`verifyApiKey`.
- **`tests/server/leads.test.js`** — `useTestDb()`; assert createOrGetLead (new + idempotent by email), getLeadByToken, getLeadById, touchLastSeen, setRevoked. (No event row needed; leads.event_id is free text.)
- **`tests/server/ingest.route.test.js`**, **`entrar.route.test.js`**, **`me.route.test.js`**, **`revoke.route.test.js`**, **`app.misc.test.js`** — `await useTestDb(); await seedEvent({ id:'evt_test', slug:'piloto', apiKey:'k'|'demo-key'|'test-key' })` (match each test's key). Drop all `DOBRO_DATA_DIR`/`writeJson`/`fs`/`os`/`path` setup. Keep every existing assertion.
- **`validate.test.js`, `session.test.js`, `webhook.test.js`, `smoke.test.js`** — unchanged.

### New `tests/server/email.test.js`
```js
import { describe, it, expect, afterEach, vi } from 'vitest';
import { sendMagicLinkEmail, magicLinkHtml } from '../../server/email.js';

afterEach(() => { delete process.env.RESEND_API_KEY; vi.restoreAllMocks(); });

describe('email', () => {
  it('builds branded html with the link', () => {
    const html = magicLinkHtml({ name: 'Diego', eventName: 'Piloto', magicLink: 'http://x/entrar/tok' });
    expect(html).toContain('http://x/entrar/tok');
    expect(html).toContain('Diego');
  });
  it('no-ops without an API key', async () => {
    const r = await sendMagicLinkEmail({ to: 'a@b.com', magicLink: 'x' });
    expect(r).toEqual({ sent: false, reason: 'no-resend-key' });
  });
  it('reports no-recipient when key present but no "to"', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const r = await sendMagicLinkEmail({ to: null, magicLink: 'x' });
    expect(r.sent).toBe(false);
  });
});
```

### Block-2 verification
- [ ] `npx vitest run` → ALL green (pg-mem offline; no network).
- [ ] If `pg-mem` rejects any SQL (e.g., `UNIQUE` on token, `RETURNING`, `ON CONFLICT`): adjust minimally (e.g., move the unique guarantee into code, or simplify) and note it. Do NOT weaken the runtime schema for Neon unless necessary; prefer test-only accommodation.

---

## Real-Neon smoke (controller-run, before credential rotation)
`npm run db:init && npm run seed && npm run link -- "Smoke" smoke@x.com`, then start the server and curl the full flow against the live Neon DB.
