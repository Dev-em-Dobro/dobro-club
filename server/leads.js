import crypto from 'node:crypto';
import { query } from './db.js';
import { generateToken } from './auth/token.js';

export function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function mapLead(row) {
  if (!row) return null;
  return {
    id: row.id, eventId: row.event_id, name: row.name, email: row.email, phone: row.phone,
    token: row.token, source: row.source, revoked: row.revoked,
    createdAt: row.created_at, lastSeenAt: row.last_seen_at
  };
}

export async function createOrGetLead(eventId, input) {
  const { rows: existing } = await query(
    `SELECT * FROM leads
     WHERE event_id = $1
       AND ( (email IS NOT NULL AND email = $2) OR (phone IS NOT NULL AND phone = $3) )
     LIMIT 1`,
    [eventId, input.email || null, input.phone || null]
  );
  if (existing[0]) return { lead: mapLead(existing[0]), isNew: false };

  const row = {
    id: newId('lead'), event_id: eventId,
    name: input.name || null, email: input.email || null, phone: input.phone || null,
    token: generateToken(), source: 'captacao-externa', revoked: false,
    created_at: new Date().toISOString(), last_seen_at: null
  };
  const { rows } = await query(
    `INSERT INTO leads (id, event_id, name, email, phone, token, source, revoked, created_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [row.id, row.event_id, row.name, row.email, row.phone, row.token, row.source, row.revoked, row.created_at, row.last_seen_at]
  );
  return { lead: mapLead(rows[0]), isNew: true };
}

export async function getLeadByToken(token) {
  const { rows } = await query('SELECT * FROM leads WHERE token = $1', [token]);
  return mapLead(rows[0]);
}

export async function getLeadById(eventId, leadId) {
  const { rows } = await query('SELECT * FROM leads WHERE event_id = $1 AND id = $2', [eventId, leadId]);
  return mapLead(rows[0]);
}

export async function touchLastSeen(eventId, leadId) {
  await query('UPDATE leads SET last_seen_at = $1 WHERE event_id = $2 AND id = $3',
    [new Date().toISOString(), eventId, leadId]);
}

export async function setRevoked(eventId, leadId, revoked) {
  const { rowCount } = await query('UPDATE leads SET revoked = $1 WHERE event_id = $2 AND id = $3',
    [revoked, eventId, leadId]);
  return rowCount > 0;
}
