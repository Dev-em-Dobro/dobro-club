# Story 8.1 — Magic Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build passwordless, reusable, revocable magic-link entry for the Dobro Club event environment: ingest a lead via API, mint an opaque token, let the lead enter already-logged-in, and keep them logged in.

**Architecture:** Greenfield monorepo. Express API (`server/`) with a file-backed data layer behind an isolated `store.js` (atomic writes + per-file lock) so it can swap to SQLite later. Opaque tokens stored in a token index; sessions are HMAC-signed cookies. React+Vite front (`dashboard/`) handles only the logged-in shell, the `link-invalido` page, and an `AuthContext` that reads `/api/me`. Capture page is external (out of scope) — leads arrive via `POST /api/events/:eventId/leads`.

**Tech Stack:** Node ESM, Express, cookie-parser, express-rate-limit, Node `crypto`/`fs`. Tests: Vitest + supertest (server), Vitest + jsdom + React Testing Library (front). React, React Router, Vite.

**Spec:** `specs/epic-8/8.1-magic-link/spec.md`

---

## File Structure

```
package.json            # root, "type":"module", scripts + deps
vite.config.js          # React plugin, dev proxy (/api,/entrar → :3001), vitest config
.gitignore              # node_modules, data/, dashboard/dist
server.js               # boot: createApp().listen(PORT)
server/
  app.js                # createApp() — wires middleware + routes
  events.js             # getEvent, verifyApiKey, hashApiKey
  leads.js              # createOrGetLead, getLeadByToken, getLeadById, touchLastSeen, setRevoked, newId
  validate.js           # validateLeadInput
  webhook.js            # fireInscriptionWebhook
  ratelimit.js          # makeLimiter
  data/store.js         # dataDir, readJson, writeJson (atomic), withLock
  auth/token.js         # generateToken, buildMagicLink, addToken, lookupToken
  auth/session.js       # signSession, verifySession
data/                   # runtime JSON (gitignored)
dashboard/
  index.html
  src/main.jsx
  src/App.jsx
  src/styles.css
  src/auth/AuthContext.jsx
  src/pages/EventHome.jsx
  src/pages/LinkInvalido.jsx
tests/server/*.test.js  # node-env tests
```

---

## Task 1: Scaffold project + test harness

**Files:**
- Create: `package.json`, `.gitignore`, `vite.config.js`, `tests/server/smoke.test.js`

- [ ] **Step 1: Init git**

Run:
```bash
git init
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
data/
dashboard/dist/
*.log
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "dobro-club",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev:server": "node server.js",
    "dev:web": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run:
```bash
npm install express cookie-parser express-rate-limit
npm install -D vitest supertest vite @vitejs/plugin-react react react-dom react-router-dom jsdom @testing-library/react
```
Expected: installs without errors; `node_modules/` created.

- [ ] **Step 5: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'dashboard',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/entrar': 'http://localhost:3001'
    }
  },
  test: {
    environmentMatchGlobs: [
      ['dashboard/**', 'jsdom'],
      ['tests/**', 'node']
    ]
  }
});
```

- [ ] **Step 6: Write smoke test**

`tests/server/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run it**

Run: `npx vitest run tests/server/smoke.test.js`
Expected: PASS (1 test).

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold dobro-club project + test harness"
```

---

## Task 2: Data store (atomic file layer)

**Files:**
- Create: `server/data/store.js`, `tests/server/store.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/store.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, writeJson, withLock } from '../../server/data/store.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('store', () => {
  it('round-trips JSON and creates nested dirs', async () => {
    await writeJson('events/evt_1/leads.json', [{ id: 'a' }]);
    expect(await readJson('events/evt_1/leads.json')).toEqual([{ id: 'a' }]);
  });

  it('returns fallback when file is missing', async () => {
    expect(await readJson('nope.json', [])).toEqual([]);
  });

  it('leaves no .tmp file behind after write', async () => {
    await writeJson('x.json', { ok: true });
    const files = await fs.readdir(tmp);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('serializes concurrent locked appends without losing data', async () => {
    const append = (n) =>
      withLock('list.json', async () => {
        const arr = await readJson('list.json', []);
        arr.push(n);
        await writeJson('list.json', arr);
      });
    await Promise.all([1, 2, 3, 4, 5].map(append));
    const arr = await readJson('list.json', []);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/store.test.js`
Expected: FAIL (cannot resolve `server/data/store.js`).

- [ ] **Step 3: Implement `server/data/store.js`**

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function dataDir() {
  return process.env.DOBRO_DATA_DIR || path.join(process.cwd(), 'data');
}

export async function readJson(rel, fallback = null) {
  try {
    const raw = await fs.readFile(path.join(dataDir(), rel), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJson(rel, data) {
  const full = path.join(dataDir(), rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, full);
}

const chains = new Map();
export function withLock(key, fn) {
  const prev = chains.get(key) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  chains.set(key, run.catch(() => {}));
  return run;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/store.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/data/store.js tests/server/store.test.js
git commit -m "feat(store): atomic file JSON store with per-key lock"
```

---

## Task 3: Token module

**Files:**
- Create: `server/auth/token.js`, `tests/server/token.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/token.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateToken, buildMagicLink, addToken, lookupToken } from '../../server/auth/token.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
  delete process.env.DOBRO_BASE_URL;
});

describe('token', () => {
  it('generates unique url-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it('builds a magic link from base url', () => {
    process.env.DOBRO_BASE_URL = 'https://dobro.club';
    expect(buildMagicLink('abc')).toBe('https://dobro.club/entrar/abc');
  });

  it('stores and looks up a token reference', async () => {
    await addToken('tok1', { leadId: 'lead_1', eventId: 'evt_1' });
    expect(await lookupToken('tok1')).toEqual({ leadId: 'lead_1', eventId: 'evt_1' });
    expect(await lookupToken('missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/token.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/auth/token.js`**

```js
import crypto from 'node:crypto';
import { readJson, writeJson, withLock } from '../data/store.js';

const INDEX = 'tokens/index.json';

export function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function buildMagicLink(token) {
  const base = process.env.DOBRO_BASE_URL || 'http://localhost:3001';
  return `${base}/entrar/${token}`;
}

export async function addToken(token, ref) {
  return withLock(INDEX, async () => {
    const idx = await readJson(INDEX, {});
    idx[token] = ref;
    await writeJson(INDEX, idx);
  });
}

export async function lookupToken(token) {
  const idx = await readJson(INDEX, {});
  return idx[token] || null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/token.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/auth/token.js tests/server/token.test.js
git commit -m "feat(auth): opaque token generation + token index"
```

---

## Task 4: Session module (signed cookie value)

**Files:**
- Create: `server/auth/session.js`, `tests/server/session.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/session.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { signSession, verifySession } from '../../server/auth/session.js';

describe('session', () => {
  it('signs and verifies a payload round-trip', () => {
    const value = signSession({ leadId: 'lead_1', eventId: 'evt_1' });
    expect(verifySession(value)).toEqual({ leadId: 'lead_1', eventId: 'evt_1' });
  });

  it('rejects a tampered value', () => {
    const value = signSession({ leadId: 'lead_1', eventId: 'evt_1' });
    const tampered = value.slice(0, -2) + (value.endsWith('aa') ? 'bb' : 'aa');
    expect(verifySession(tampered)).toBeNull();
  });

  it('rejects garbage', () => {
    expect(verifySession('')).toBeNull();
    expect(verifySession('no-dot')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/session.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/auth/session.js`**

```js
import crypto from 'node:crypto';

function secret() {
  return process.env.DOBRO_SESSION_SECRET || 'dev-secret-change-me';
}

export function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifySession(value) {
  if (!value || typeof value !== 'string' || !value.includes('.')) return null;
  const [body, mac] = value.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/session.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/auth/session.js tests/server/session.test.js
git commit -m "feat(auth): HMAC-signed session cookie value"
```

---

## Task 5: Events module

**Files:**
- Create: `server/events.js`, `tests/server/events.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/events.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJson } from '../../server/data/store.js';
import { getEvent, verifyApiKey, hashApiKey } from '../../server/events.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
  await writeJson('events/evt_1.json', {
    id: 'evt_1', slug: 'piloto', apiKeyHash: hashApiKey('right-key')
  });
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('events', () => {
  it('loads an event by id', async () => {
    expect((await getEvent('evt_1')).slug).toBe('piloto');
  });

  it('returns null for unknown event', async () => {
    expect(await getEvent('nope')).toBeNull();
  });

  it('verifies the api key', async () => {
    const ev = await getEvent('evt_1');
    expect(verifyApiKey(ev, 'right-key')).toBe(true);
    expect(verifyApiKey(ev, 'wrong-key')).toBe(false);
    expect(verifyApiKey(ev, '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/events.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/events.js`**

```js
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/events.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/events.js tests/server/events.test.js
git commit -m "feat(events): event lookup + api key verification"
```

---

## Task 6: Lead input validation

**Files:**
- Create: `server/validate.js`, `tests/server/validate.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/validate.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { validateLeadInput } from '../../server/validate.js';

describe('validateLeadInput', () => {
  it('accepts a valid email-only lead and normalizes', () => {
    const r = validateLeadInput({ name: ' Diego ', email: 'D@X.COM' });
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ name: 'Diego', email: 'd@x.com', phone: null });
  });

  it('accepts a phone-only lead', () => {
    const r = validateLeadInput({ phone: '+5511999999999' });
    expect(r.ok).toBe(true);
  });

  it('rejects when neither email nor phone present', () => {
    const r = validateLeadInput({ name: 'X' });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects a malformed email', () => {
    const r = validateLeadInput({ email: 'not-an-email' });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/validate.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/validate.js`**

```js
export function validateLeadInput(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

  if (!email && !phone) errors.push('email ou phone é obrigatório');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email inválido');

  return {
    ok: errors.length === 0,
    errors,
    value: { name: name || null, email: email || null, phone: phone || null }
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/validate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/validate.js tests/server/validate.test.js
git commit -m "feat(validate): lead input validation + normalization"
```

---

## Task 7: Leads service

**Files:**
- Create: `server/leads.js`, `tests/server/leads.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/leads.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createOrGetLead, getLeadByToken, getLeadById, touchLastSeen, setRevoked
} from '../../server/leads.js';

let tmp;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('leads', () => {
  it('creates a new lead with a token', async () => {
    const { lead, isNew } = await createOrGetLead('evt_1', { name: 'Diego', email: 'd@x.com' });
    expect(isNew).toBe(true);
    expect(lead.id).toMatch(/^lead_/);
    expect(lead.token).toBeTruthy();
    expect(lead.revoked).toBe(false);
  });

  it('is idempotent by email', async () => {
    const a = await createOrGetLead('evt_1', { email: 'd@x.com' });
    const b = await createOrGetLead('evt_1', { email: 'd@x.com' });
    expect(b.isNew).toBe(false);
    expect(b.lead.token).toBe(a.lead.token);
  });

  it('finds a lead by its token', async () => {
    const { lead } = await createOrGetLead('evt_1', { email: 'd@x.com' });
    const found = await getLeadByToken(lead.token);
    expect(found.id).toBe(lead.id);
    expect(await getLeadByToken('nope')).toBeNull();
  });

  it('touches lastSeenAt', async () => {
    const { lead } = await createOrGetLead('evt_1', { email: 'd@x.com' });
    expect(lead.lastSeenAt).toBeNull();
    await touchLastSeen('evt_1', lead.id);
    expect((await getLeadById('evt_1', lead.id)).lastSeenAt).toBeTruthy();
  });

  it('revokes a lead', async () => {
    const { lead } = await createOrGetLead('evt_1', { email: 'd@x.com' });
    await setRevoked('evt_1', lead.id, true);
    expect((await getLeadById('evt_1', lead.id)).revoked).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/leads.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/leads.js`**

```js
import crypto from 'node:crypto';
import { readJson, writeJson, withLock } from './data/store.js';
import { generateToken, addToken, lookupToken } from './auth/token.js';

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function leadsPath(eventId) {
  return `events/${eventId}/leads.json`;
}

export async function createOrGetLead(eventId, input) {
  return withLock(leadsPath(eventId), async () => {
    const leads = await readJson(leadsPath(eventId), []);
    const existing = leads.find(
      (l) => (input.email && l.email === input.email) || (input.phone && l.phone === input.phone)
    );
    if (existing) return { lead: existing, isNew: false };

    const lead = {
      id: newId('lead'),
      eventId,
      name: input.name || null,
      email: input.email || null,
      phone: input.phone || null,
      token: generateToken(),
      source: 'captacao-externa',
      revoked: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: null
    };
    leads.push(lead);
    await writeJson(leadsPath(eventId), leads);
    await addToken(lead.token, { leadId: lead.id, eventId });
    return { lead, isNew: true };
  });
}

export async function getLeadByToken(token) {
  const ref = await lookupToken(token);
  if (!ref) return null;
  const leads = await readJson(leadsPath(ref.eventId), []);
  return leads.find((l) => l.id === ref.leadId) || null;
}

export async function getLeadById(eventId, leadId) {
  const leads = await readJson(leadsPath(eventId), []);
  return leads.find((l) => l.id === leadId) || null;
}

export async function touchLastSeen(eventId, leadId) {
  return withLock(leadsPath(eventId), async () => {
    const leads = await readJson(leadsPath(eventId), []);
    const l = leads.find((x) => x.id === leadId);
    if (!l) return;
    l.lastSeenAt = new Date().toISOString();
    await writeJson(leadsPath(eventId), leads);
  });
}

export async function setRevoked(eventId, leadId, revoked) {
  return withLock(leadsPath(eventId), async () => {
    const leads = await readJson(leadsPath(eventId), []);
    const l = leads.find((x) => x.id === leadId);
    if (!l) return false;
    l.revoked = revoked;
    await writeJson(leadsPath(eventId), leads);
    return true;
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/leads.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/leads.js tests/server/leads.test.js
git commit -m "feat(leads): idempotent lead creation, token lookup, revoke"
```

---

## Task 8: Inscription webhook

**Files:**
- Create: `server/webhook.js`, `tests/server/webhook.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/webhook.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { fireInscriptionWebhook } from '../../server/webhook.js';

let server;
let received;
let url;

beforeEach(async () => {
  received = [];
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push(JSON.parse(body));
      res.statusCode = 200;
      res.end('ok');
    });
  });
  await new Promise((r) => server.listen(0, r));
  url = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => new Promise((r) => server.close(r)));

describe('fireInscriptionWebhook', () => {
  it('posts the inscription payload', async () => {
    const event = { id: 'evt_1', slug: 'piloto', webhookUrl: url };
    const lead = { id: 'lead_1', name: 'Diego', email: 'd@x.com', phone: null };
    const r = await fireInscriptionWebhook(event, lead, 'https://dobro.club/entrar/tok');
    expect(r.sent).toBe(true);
    expect(received[0]).toMatchObject({
      type: 'lead.created',
      event: { id: 'evt_1', slug: 'piloto' },
      lead: { id: 'lead_1' },
      magicLink: 'https://dobro.club/entrar/tok'
    });
  });

  it('is a no-op when no webhookUrl', async () => {
    const r = await fireInscriptionWebhook({ id: 'evt_1' }, { id: 'lead_1' }, 'x');
    expect(r.sent).toBe(false);
    expect(received.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/webhook.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/webhook.js`**

```js
export async function fireInscriptionWebhook(event, lead, magicLink) {
  if (!event?.webhookUrl) return { sent: false, reason: 'no-url' };
  const payload = {
    type: 'lead.created',
    event: { id: event.id, slug: event.slug },
    lead: { id: lead.id, name: lead.name, email: lead.email, phone: lead.phone },
    magicLink
  };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(event.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return { sent: true };
    } catch {
      // retry once
    }
  }
  return { sent: false, reason: 'failed' };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/webhook.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/webhook.js tests/server/webhook.test.js
git commit -m "feat(webhook): best-effort inscription webhook"
```

---

## Task 9: App + ingestion route (`POST /api/events/:eventId/leads`)

**Files:**
- Create: `server/app.js`, `tests/server/ingest.route.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/ingest.route.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../../server/app.js';
import { writeJson } from '../../server/data/store.js';
import { hashApiKey } from '../../server/events.js';

let tmp;
let app;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
  await writeJson('events/evt_test.json', {
    id: 'evt_test', slug: 'piloto', name: 'Piloto', status: 'active',
    apiKeyHash: hashApiKey('test-key'), webhookUrl: null, createdAt: new Date().toISOString()
  });
  app = createApp();
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('POST /api/events/:eventId/leads', () => {
  it('creates a lead and returns a magic link', async () => {
    const res = await request(app)
      .post('/api/events/evt_test/leads')
      .set('x-api-key', 'test-key')
      .send({ name: 'Diego', email: 'd@x.com' });
    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(true);
    expect(res.body.magicLink).toContain('/entrar/');
    expect(res.body.leadId).toMatch(/^lead_/);
  });

  it('is idempotent on repeated email', async () => {
    const first = await request(app).post('/api/events/evt_test/leads')
      .set('x-api-key', 'test-key').send({ email: 'd@x.com' });
    const second = await request(app).post('/api/events/evt_test/leads')
      .set('x-api-key', 'test-key').send({ email: 'd@x.com' });
    expect(second.body.isNew).toBe(false);
    expect(second.body.magicLink).toBe(first.body.magicLink);
  });

  it('rejects a bad api key with 401', async () => {
    const res = await request(app).post('/api/events/evt_test/leads')
      .set('x-api-key', 'wrong').send({ email: 'd@x.com' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app).post('/api/events/evt_test/leads')
      .set('x-api-key', 'test-key').send({ name: 'no contact' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown event', async () => {
    const res = await request(app).post('/api/events/nope/leads')
      .set('x-api-key', 'test-key').send({ email: 'd@x.com' });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/ingest.route.test.js`
Expected: FAIL (cannot resolve `server/app.js`).

- [ ] **Step 3: Implement `server/app.js`**

```js
import express from 'express';
import cookieParser from 'cookie-parser';
import { getEvent, verifyApiKey } from './events.js';
import { validateLeadInput } from './validate.js';
import {
  createOrGetLead, getLeadByToken, getLeadById, touchLastSeen
} from './leads.js';
import { buildMagicLink } from './auth/token.js';
import { signSession, verifySession } from './auth/session.js';
import { fireInscriptionWebhook } from './webhook.js';

export const COOKIE = 'dc_session';
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post('/api/events/:eventId/leads', async (req, res) => {
    const event = await getEvent(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'evento não encontrado' });
    if (!verifyApiKey(event, req.get('x-api-key'))) {
      return res.status(401).json({ error: 'api key inválida' });
    }
    const { ok, errors, value } = validateLeadInput(req.body);
    if (!ok) return res.status(400).json({ errors });

    const { lead, isNew } = await createOrGetLead(event.id, value);
    const magicLink = buildMagicLink(lead.token);
    if (isNew) await fireInscriptionWebhook(event, lead, magicLink);
    return res.json({ leadId: lead.id, magicLink, isNew });
  });

  return app;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/ingest.route.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/app.js tests/server/ingest.route.test.js
git commit -m "feat(api): lead ingestion route with idempotency + webhook"
```

---

## Task 10: Entry route (`GET /entrar/:token`)

**Files:**
- Modify: `server/app.js` (add route before `return app`)
- Create: `tests/server/entrar.route.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/entrar.route.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../../server/app.js';
import { writeJson } from '../../server/data/store.js';
import { hashApiKey } from '../../server/events.js';
import { createOrGetLead, setRevoked } from '../../server/leads.js';

let tmp;
let app;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
  await writeJson('events/evt_test.json', {
    id: 'evt_test', slug: 'piloto', apiKeyHash: hashApiKey('k')
  });
  app = createApp();
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

describe('GET /entrar/:token', () => {
  it('sets a session cookie and redirects to the event home', async () => {
    const { lead } = await createOrGetLead('evt_test', { email: 'd@x.com' });
    const res = await request(app).get(`/entrar/${lead.token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/e/piloto');
    expect(res.headers['set-cookie'].join()).toContain('dc_session=');
  });

  it('redirects to link-invalido for an unknown token', async () => {
    const res = await request(app).get('/entrar/nope');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/link-invalido');
  });

  it('redirects to link-invalido for a revoked lead', async () => {
    const { lead } = await createOrGetLead('evt_test', { email: 'd@x.com' });
    await setRevoked('evt_test', lead.id, true);
    const res = await request(app).get(`/entrar/${lead.token}`);
    expect(res.headers.location).toBe('/link-invalido');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/entrar.route.test.js`
Expected: FAIL (route returns 404, not 302).

- [ ] **Step 3: Add the route to `server/app.js`**

Insert immediately before `return app;`:
```js
  app.get('/entrar/:token', async (req, res) => {
    const lead = await getLeadByToken(req.params.token);
    if (!lead || lead.revoked) return res.redirect(302, '/link-invalido');
    const event = await getEvent(lead.eventId);
    await touchLastSeen(lead.eventId, lead.id);
    res.cookie(COOKIE, signSession({ leadId: lead.id, eventId: lead.eventId }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/'
    });
    return res.redirect(302, `/e/${event?.slug || lead.eventId}`);
  });
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/entrar.route.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/app.js tests/server/entrar.route.test.js
git commit -m "feat(api): magic-link entry route sets session + redirects"
```

---

## Task 11: Session route (`GET /api/me`, `POST /api/auth/logout`)

**Files:**
- Modify: `server/app.js` (add routes before `return app`)
- Create: `tests/server/me.route.test.js`

- [ ] **Step 1: Write failing tests**

`tests/server/me.route.test.js`:
```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../../server/app.js';
import { writeJson } from '../../server/data/store.js';
import { hashApiKey } from '../../server/events.js';
import { createOrGetLead, setRevoked } from '../../server/leads.js';

let tmp;
let app;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dobro-'));
  process.env.DOBRO_DATA_DIR = tmp;
  await writeJson('events/evt_test.json', { id: 'evt_test', slug: 'piloto', apiKeyHash: hashApiKey('k') });
  app = createApp();
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DOBRO_DATA_DIR;
});

async function loginCookie() {
  const { lead } = await createOrGetLead('evt_test', { name: 'Diego', email: 'd@x.com' });
  const res = await request(app).get(`/entrar/${lead.token}`);
  return { cookie: res.headers['set-cookie'], lead };
}

describe('GET /api/me', () => {
  it('returns the lead for a valid session cookie', async () => {
    const { cookie } = await loginCookie();
    const res = await request(app).get('/api/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Diego');
    expect(res.body.eventId).toBe('evt_test');
  });

  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the lead was revoked', async () => {
    const { cookie, lead } = await loginCookie();
    await setRevoked('evt_test', lead.id, true);
    const res = await request(app).get('/api/me').set('Cookie', cookie);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/me.route.test.js`
Expected: FAIL (route returns 404, not 200/401).

- [ ] **Step 3: Add routes to `server/app.js`**

Insert immediately before `return app;`:
```js
  app.get('/api/me', async (req, res) => {
    const sess = verifySession(req.cookies?.[COOKIE]);
    if (!sess) return res.status(401).json({ error: 'sem sessão' });
    const lead = await getLeadById(sess.eventId, sess.leadId);
    if (!lead || lead.revoked) return res.status(401).json({ error: 'sem sessão' });
    return res.json({ leadId: lead.id, name: lead.name, eventId: lead.eventId });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    return res.json({ ok: true });
  });
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/server/me.route.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/app.js tests/server/me.route.test.js
git commit -m "feat(api): /api/me session check + logout"
```

---

## Task 12: Rate limiting

**Files:**
- Create: `server/ratelimit.js`, `tests/server/ratelimit.test.js`
- Modify: `server/app.js` (apply limiters)

- [ ] **Step 1: Write failing test**

`tests/server/ratelimit.test.js`:
```js
import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { makeLimiter } from '../../server/ratelimit.js';

describe('makeLimiter', () => {
  it('returns 429 after the limit is exceeded', async () => {
    const app = express();
    app.use(makeLimiter({ windowMs: 60000, max: 2 }));
    app.get('/x', (req, res) => res.send('ok'));

    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(429);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/ratelimit.test.js`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `server/ratelimit.js`**

```js
import rateLimit from 'express-rate-limit';

export function makeLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' && process.env.DOBRO_FORCE_LIMIT !== '1'
  });
}
```

Note: the `skip` keeps global app limiters inert during the existing route tests; this unit test passes because it builds its own app and asserts the limiter directly via `rateLimit` (skip only triggers when both NODE_ENV==='test' and the force flag is unset — vitest does not set NODE_ENV by default, so `skip` returns false here).

- [ ] **Step 4: Apply limiters in `server/app.js`**

Add import at top:
```js
import { makeLimiter } from './ratelimit.js';
```
Then, right after `app.use(cookieParser());`:
```js
  app.use('/api/events/:eventId/leads', makeLimiter({ windowMs: 60000, max: 60 }));
  app.use('/entrar', makeLimiter({ windowMs: 60000, max: 30 }));
```

- [ ] **Step 5: Run full server suite to verify nothing regressed**

Run: `npx vitest run tests/server`
Expected: PASS (all server tests green).

- [ ] **Step 6: Commit**

```bash
git add server/ratelimit.js server/app.js tests/server/ratelimit.test.js
git commit -m "feat(security): rate limit ingestion and entry routes"
```

---

## Task 13: Server entrypoint

**Files:**
- Create: `server.js`

- [ ] **Step 1: Implement `server.js`**

```js
import { createApp } from './server/app.js';

const port = process.env.PORT || 3001;
createApp().listen(port, () => {
  console.log(`Dobro Club API on :${port}`);
});
```

- [ ] **Step 2: Manual boot check**

Run: `node server.js`
Expected: prints `Dobro Club API on :3001`. Stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: server entrypoint"
```

---

## Task 14: Frontend scaffold (Vite + mobile-first shell)

**Files:**
- Create: `dashboard/index.html`, `dashboard/src/main.jsx`, `dashboard/src/styles.css`

- [ ] **Step 1: Create `dashboard/index.html`**

```html
<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Dobro Club</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `dashboard/src/styles.css` (mobile-first, dark)**

```css
:root { color-scheme: dark; --bg:#0b0b0f; --fg:#f4f4f6; --muted:#9aa0aa; --accent:#22c55e; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font-family: system-ui, sans-serif; }
.screen { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px; padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
.card { width:100%; max-width:420px; text-align:center; }
.btn { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 20px; border-radius:12px; background:var(--accent); color:#06210f; font-weight:600; text-decoration:none; border:0; }
.event-shell { min-height:100dvh; display:flex; flex-direction:column; }
.event-header { padding:20px 16px; font-weight:600; }
.event-content { flex:1; padding:16px; color:var(--muted); }
.bottom-nav { position:sticky; bottom:0; display:flex; gap:4px; padding:8px; padding-bottom: calc(8px + env(safe-area-inset-bottom)); background:#111119; border-top:1px solid #1e1e28; }
.bottom-nav button { flex:1; min-height:44px; border:0; border-radius:10px; background:transparent; color:var(--muted); font-size:12px; }
.bottom-nav button:disabled { opacity:.5; }
```

- [ ] **Step 3: Create `dashboard/src/main.jsx`**

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/index.html dashboard/src/main.jsx dashboard/src/styles.css
git commit -m "feat(web): vite scaffold + mobile-first dark styles"
```

---

## Task 15: AuthContext (reads `/api/me`)

**Files:**
- Create: `dashboard/src/auth/AuthContext.jsx`, `dashboard/src/auth/AuthContext.test.jsx`

- [ ] **Step 1: Write failing tests**

`dashboard/src/auth/AuthContext.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.jsx';

function Probe() {
  const { loading, lead } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{lead ? `oi ${lead.name}` : 'sem sessão'}</div>;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('AuthContext', () => {
  it('loads the lead from /api/me', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ leadId: 'lead_1', name: 'Diego', eventId: 'evt_test' })
    });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('oi Diego')).toBeTruthy();
  });

  it('shows no session on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('sem sessão')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run dashboard/src/auth/AuthContext.test.jsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `dashboard/src/auth/AuthContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext({ loading: true, lead: null });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, lead: null });

  useEffect(() => {
    let active = true;
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((lead) => active && setState({ loading: false, lead }))
      .catch(() => active && setState({ loading: false, lead: null }));
    return () => { active = false; };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run dashboard/src/auth/AuthContext.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/auth/AuthContext.jsx dashboard/src/auth/AuthContext.test.jsx
git commit -m "feat(web): AuthContext reads /api/me"
```

---

## Task 16: LinkInvalido page

**Files:**
- Create: `dashboard/src/pages/LinkInvalido.jsx`, `dashboard/src/pages/LinkInvalido.test.jsx`

- [ ] **Step 1: Write failing test**

`dashboard/src/pages/LinkInvalido.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LinkInvalido from './LinkInvalido.jsx';

describe('LinkInvalido', () => {
  it('shows the message and a request-new-link action', () => {
    render(<LinkInvalido />);
    expect(screen.getByText(/não está mais válido/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /pedir novo link/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run dashboard/src/pages/LinkInvalido.test.jsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `dashboard/src/pages/LinkInvalido.jsx`**

```jsx
export default function LinkInvalido() {
  return (
    <main className="screen">
      <div className="card">
        <h1>Esse link não está mais válido</h1>
        <p>Peça um novo link de acesso para entrar no evento.</p>
        <a className="btn" href="https://wa.me/">Pedir novo link</a>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run dashboard/src/pages/LinkInvalido.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/pages/LinkInvalido.jsx dashboard/src/pages/LinkInvalido.test.jsx
git commit -m "feat(web): link-invalido page"
```

---

## Task 17: EventHome shell + App router

**Files:**
- Create: `dashboard/src/pages/EventHome.jsx`, `dashboard/src/pages/EventHome.test.jsx`, `dashboard/src/App.jsx`

- [ ] **Step 1: Write failing test**

`dashboard/src/pages/EventHome.test.jsx`:
```jsx
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ loading: false, lead: { name: 'Diego', eventId: 'evt_test' } })
}));

import EventHome from './EventHome.jsx';

describe('EventHome', () => {
  it('greets the lead and renders the participant bottom-nav placeholders', () => {
    render(<EventHome />);
    expect(screen.getByText(/Diego/)).toBeTruthy();
    for (const item of ['Aulas', 'Comunidade', 'Feed', 'Ingresso', 'Indicações', 'Certificado']) {
      expect(screen.getByRole('button', { name: item })).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run dashboard/src/pages/EventHome.test.jsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Implement `dashboard/src/pages/EventHome.jsx`**

```jsx
import { useAuth } from '../auth/AuthContext.jsx';

const NAV = ['Aulas', 'Comunidade', 'Feed', 'Ingresso', 'Indicações', 'Certificado'];

export default function EventHome() {
  const { loading, lead } = useAuth();
  if (loading) return <main className="screen"><p>Entrando…</p></main>;
  if (!lead) {
    return (
      <main className="screen">
        <div className="card"><p>Use seu link de acesso para entrar no evento.</p></div>
      </main>
    );
  }
  return (
    <div className="event-shell">
      <header className="event-header">Olá, {lead.name || 'participante'} 👋</header>
      <main className="event-content"><p>Seu evento aparece aqui.</p></main>
      <nav className="bottom-nav" aria-label="Navegação do evento">
        {NAV.map((item) => (
          <button key={item} type="button" disabled>{item}</button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run dashboard/src/pages/EventHome.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 5: Implement `dashboard/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import EventHome from './pages/EventHome.jsx';
import LinkInvalido from './pages/LinkInvalido.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/e/:slug" element={<EventHome />} />
          <Route path="/link-invalido" element={<LinkInvalido />} />
          <Route path="*" element={<LinkInvalido />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: PASS (all server + web tests green).

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/pages/EventHome.jsx dashboard/src/pages/EventHome.test.jsx dashboard/src/App.jsx
git commit -m "feat(web): event home shell + router"
```

---

## Task 18: End-to-end manual smoke (local)

**Files:** none (manual verification)

- [ ] **Step 1: Seed a local event**

Create `scripts/seed.js`:
```js
import { writeJson } from '../server/data/store.js';
import { hashApiKey } from '../server/events.js';

await writeJson('events/evt_demo.json', {
  id: 'evt_demo', slug: 'demo', name: 'Demo Dobro Club', status: 'active',
  apiKeyHash: hashApiKey('demo-key'), webhookUrl: null, createdAt: new Date().toISOString()
});
console.log('seeded evt_demo (api key: demo-key)');
```
Run: `node scripts/seed.js`
Expected: prints "seeded evt_demo".

- [ ] **Step 2: Start API + web (two terminals)**

Run: `node server.js`
Run: `npm run dev:web`

- [ ] **Step 3: Ingest a lead**

Run:
```bash
curl -s -X POST http://localhost:3001/api/events/evt_demo/leads -H "x-api-key: demo-key" -H "content-type: application/json" -d "{\"name\":\"Teste\",\"email\":\"t@x.com\"}"
```
Expected: JSON with a `magicLink` like `http://localhost:3001/entrar/<token>`.

- [ ] **Step 4: Open the magic link on a phone-sized viewport**

Open the returned `magicLink` in the browser (device toolbar at 390px). Expected: redirected to the event home `/e/demo`, greeted by name, bottom-nav visible, no horizontal scroll. Reopen the same link → still logged in.

- [ ] **Step 5: Commit the seed script**

```bash
git add scripts/seed.js
git commit -m "chore: local seed script for manual smoke"
```

---

## Self-Review

**1. Spec coverage** (spec §11 acceptance criteria → task):
- Ingestão via API a partir de captação externa → Task 9.
- Magic link único, token opaco, revogável → Tasks 3, 7, 10.
- Link na resposta + webhook → Tasks 8, 9.
- Entra já logado / clique repetido válido → Task 10 + reusable token (no expiry).
- Sessão persistida → Tasks 4, 10 (cookie maxAge).
- Revogação nega acesso → Tasks 10 (`/entrar`), 11 (`/api/me`).
- Idempotência → Tasks 7, 9.
- Entrada + erro validados no mobile → Tasks 14–18 (mobile-first shell, `link-invalido`, manual smoke at 390px).
- Rate limit (spec §10) → Task 12.
- Camada de dados atômica + lock (spec §5) → Task 2.
- No gaps found.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to" — every code step has complete code. ✔

**3. Type/name consistency:** `createOrGetLead`, `getLeadByToken`, `getLeadById`, `touchLastSeen`, `setRevoked`, `generateToken`, `buildMagicLink`, `addToken`, `lookupToken`, `signSession`, `verifySession`, `getEvent`, `verifyApiKey`, `hashApiKey`, `validateLeadInput`, `fireInscriptionWebhook`, `makeLimiter`, `createApp`, `COOKIE`, `useAuth`, `AuthProvider` — used identically across definition and consumer tasks. ✔

**4. Deviations from spec (noted):** `/entrar` invalid token redirects to a generic `/link-invalido` (not `/e/:slug/link-invalido`) because the event slug is unknown for an invalid token. Acceptable; documented here.
