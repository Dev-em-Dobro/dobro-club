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
