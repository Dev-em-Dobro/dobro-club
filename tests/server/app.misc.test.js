import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { useTestDb } from '../helpers/db.js';

let app;
beforeEach(async () => {
  await useTestDb();
  app = createApp();
});

describe('app misc', () => {
  it('returns JSON 404 for unknown /api routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
