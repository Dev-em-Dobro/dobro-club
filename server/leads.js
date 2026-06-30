import crypto from 'node:crypto';
import { readJson, writeJson, withLock } from './data/store.js';
import { generateToken, addToken, lookupToken } from './auth/token.js';

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function leadsPath(eventId) {
  return `events/${eventId}/leads.json`;
}

export async function createOrGetLead(eventId, input) {
  return withLock(leadsPath(eventId), async () => {
    const leads = await readJson(leadsPath(eventId), []);
    const existing = leads.find(
      (l) => (input.email && l.email === input.email) || (input.phone && l.phone === input.phone)
    );
    if (existing) return { lead: existing, isNew: false };

    const lead = {
      id: newId('lead'),
      eventId,
      name: input.name || null,
      email: input.email || null,
      phone: input.phone || null,
      token: generateToken(),
      source: 'captacao-externa',
      revoked: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: null
    };
    leads.push(lead);
    await writeJson(leadsPath(eventId), leads);
    await addToken(lead.token, { leadId: lead.id, eventId });
    return { lead, isNew: true };
  });
}

export async function getLeadByToken(token) {
  const ref = await lookupToken(token);
  if (!ref) return null;
  const leads = await readJson(leadsPath(ref.eventId), []);
  return leads.find((l) => l.id === ref.leadId) || null;
}

export async function getLeadById(eventId, leadId) {
  const leads = await readJson(leadsPath(eventId), []);
  return leads.find((l) => l.id === leadId) || null;
}

export async function touchLastSeen(eventId, leadId) {
  return withLock(leadsPath(eventId), async () => {
    const leads = await readJson(leadsPath(eventId), []);
    const l = leads.find((x) => x.id === leadId);
    if (!l) return;
    l.lastSeenAt = new Date().toISOString();
    await writeJson(leadsPath(eventId), leads);
  });
}

export async function setRevoked(eventId, leadId, revoked) {
  return withLock(leadsPath(eventId), async () => {
    const leads = await readJson(leadsPath(eventId), []);
    const l = leads.find((x) => x.id === leadId);
    if (!l) return false;
    l.revoked = revoked;
    await writeJson(leadsPath(eventId), leads);
    return true;
  });
}
