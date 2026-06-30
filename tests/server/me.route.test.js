import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { useTestDb, seedEvent } from '../helpers/db.js';
import { createOrGetLead, setRevoked } from '../../server/leads.js';

let app;
beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: 'evt_test', slug: 'piloto', apiKey: 'k' });
  app = createApp();
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
