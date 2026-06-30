import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app.js';
import { useTestDb, seedEvent } from '../helpers/db.js';
import { createOrGetLead } from '../../server/leads.js';

let app;
beforeEach(async () => {
  await useTestDb();
  await seedEvent({ id: 'evt_test', slug: 'piloto', apiKey: 'k' });
  app = createApp();
});

describe('POST /api/events/:eventId/leads/:leadId/revoke', () => {
  it('revokes a lead with valid api key and makes token and session invalid', async () => {
    const { lead } = await createOrGetLead('evt_test', { name: 'Alice', email: 'alice@x.com' });

    // Login first to get a valid session cookie
    const loginRes = await request(app).get(`/entrar/${lead.token}`);
    const cookie = loginRes.headers['set-cookie'];

    // Revoke with valid api key → 200 { revoked: true }
    const revokeRes = await request(app)
      .post(`/api/events/evt_test/leads/${lead.id}/revoke`)
      .set('x-api-key', 'k');
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.revoked).toBe(true);

    // Magic link for that lead should now → 302 /link-invalido
    const enterRes = await request(app).get(`/entrar/${lead.token}`);
    expect(enterRes.status).toBe(302);
    expect(enterRes.headers.location).toBe('/link-invalido');

    // Prior session cookie should now be 401
    const meRes = await request(app).get('/api/me').set('Cookie', cookie);
    expect(meRes.status).toBe(401);
  });

  it('returns 401 with wrong api key', async () => {
    const { lead } = await createOrGetLead('evt_test', { name: 'Bob', email: 'bob@x.com' });
    const res = await request(app)
      .post(`/api/events/evt_test/leads/${lead.id}/revoke`)
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown leadId', async () => {
    const res = await request(app)
      .post('/api/events/evt_test/leads/lead_nonexistent/revoke')
      .set('x-api-key', 'k');
    expect(res.status).toBe(404);
  });
});
