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

  return app;
}
