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
