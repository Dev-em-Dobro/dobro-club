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
