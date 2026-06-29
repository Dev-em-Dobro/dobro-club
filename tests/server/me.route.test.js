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
