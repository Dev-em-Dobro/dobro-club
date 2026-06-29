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

  it('returns 400 for a path-traversal event id', async () => {
    const res = await request(app).post('/api/events/..%2f..%2fx/leads')
      .set('x-api-key', 'test-key').send({ email: 'd@x.com' });
    expect(res.status).toBe(400);
  });
});
