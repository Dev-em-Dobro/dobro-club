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
import { makeLimiter } from './ratelimit.js';

export const COOKIE = 'dc_session';
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60 * 1000;

export function createApp() {
  const app = express();
  // Trust N proxy hops so req.ip (used for rate limiting) reflects the real client.
  // 0 = no proxy (safe default); set TRUST_PROXY_HOPS at deploy when behind a proxy.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 0);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/events/:eventId/leads', makeLimiter({ windowMs: 60000, max: 60 }));
  app.use('/entrar', makeLimiter({ windowMs: 60000, max: 30 }));

  app.post('/api/events/:eventId/leads', async (req, res) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(req.params.eventId)) {
      return res.status(400).json({ error: 'id de evento inválido' });
    }
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

  app.get('/api/me', async (req, res) => {
    const sess = verifySession(req.cookies?.[COOKIE]);
    if (!sess) return res.status(401).json({ error: 'sem sessão' });
    const lead = await getLeadById(sess.eventId, sess.leadId);
    if (!lead || lead.revoked) return res.status(401).json({ error: 'sem sessão' });
    return res.json({ leadId: lead.id, name: lead.name, eventId: lead.eventId });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    return res.json({ ok: true });
  });

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

  app.use('/api', (req, res) => res.status(404).json({ error: 'não encontrado' }));

  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'erro interno' });
  });

  return app;
}
