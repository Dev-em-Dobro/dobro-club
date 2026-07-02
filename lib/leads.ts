import crypto from "node:crypto";
import { query } from "./db";
import { generateToken } from "./auth/token";
import type { LeadInput } from "./validate";

export interface Lead {
  id: string;
  eventId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  token: string;
  source: string | null;
  revoked: boolean;
  createdAt: string | null;
  lastSeenAt: string | null;
  photoUrl: string | null;
  referrerLeadId: string | null;
}

interface LeadRow {
  id: string;
  event_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  token: string;
  source: string | null;
  revoked: boolean;
  created_at: string | null;
  last_seen_at: string | null;
  photo_url: string | null;
  referrer_lead_id: string | null;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function mapLead(row: LeadRow | undefined): Lead | null {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    token: row.token,
    source: row.source,
    revoked: row.revoked,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    photoUrl: row.photo_url,
    referrerLeadId: row.referrer_lead_id,
  };
}

export async function createOrGetLead(
  eventId: string,
  input: LeadInput,
): Promise<{ lead: Lead; isNew: boolean }> {
  const { rows: existing } = await query<LeadRow>(
    `SELECT * FROM leads
     WHERE event_id = $1
       AND ( (email IS NOT NULL AND email = $2) OR (phone IS NOT NULL AND phone = $3) )
     LIMIT 1`,
    [eventId, input.email || null, input.phone || null],
  );
  if (existing[0]) return { lead: mapLead(existing[0])!, isNew: false };

  const row = {
    id: newId("lead"),
    event_id: eventId,
    name: input.name || null,
    email: input.email || null,
    phone: input.phone || null,
    token: generateToken(),
    source: "captacao-externa",
    revoked: false,
    created_at: new Date().toISOString(),
    last_seen_at: null,
  };
  const ins = await query<LeadRow>(
    `INSERT INTO leads (id, event_id, name, email, phone, token, source, revoked, created_at, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *`,
    [
      row.id,
      row.event_id,
      row.name,
      row.email,
      row.phone,
      row.token,
      row.source,
      row.revoked,
      row.created_at,
      row.last_seen_at,
    ],
  );
  if (ins.rows[0]) return { lead: mapLead(ins.rows[0])!, isNew: true };
  // Lost the race — another concurrent request inserted the same email/phone.
  const { rows: again } = await query<LeadRow>(
    `SELECT * FROM leads WHERE event_id = $1 AND ((email IS NOT NULL AND email = $2) OR (phone IS NOT NULL AND phone = $3)) LIMIT 1`,
    [eventId, input.email || null, input.phone || null],
  );
  return { lead: mapLead(again[0])!, isNew: false };
}

export async function getLeadByToken(token: string): Promise<Lead | null> {
  const { rows } = await query<LeadRow>("SELECT * FROM leads WHERE token = $1", [
    token,
  ]);
  return mapLead(rows[0]);
}

export async function getLeadById(
  eventId: string,
  leadId: string,
): Promise<Lead | null> {
  const { rows } = await query<LeadRow>(
    "SELECT * FROM leads WHERE event_id = $1 AND id = $2",
    [eventId, leadId],
  );
  return mapLead(rows[0]);
}

export async function getLeadByEmail(
  eventId: string,
  email: string,
): Promise<Lead | null> {
  const { rows } = await query<LeadRow>(
    "SELECT * FROM leads WHERE event_id = $1 AND email IS NOT NULL AND email = $2 LIMIT 1",
    [eventId, email.trim().toLowerCase()],
  );
  return mapLead(rows[0]);
}

export async function getLeadByPhone(
  eventId: string,
  phone: string,
): Promise<Lead | null> {
  const { rows } = await query<LeadRow>(
    "SELECT * FROM leads WHERE event_id = $1 AND phone IS NOT NULL AND phone = $2 LIMIT 1",
    [eventId, phone],
  );
  return mapLead(rows[0]);
}

export async function touchLastSeen(
  eventId: string,
  leadId: string,
): Promise<void> {
  await query(
    "UPDATE leads SET last_seen_at = $1 WHERE event_id = $2 AND id = $3",
    [new Date().toISOString(), eventId, leadId],
  );
}

export async function setRevoked(
  eventId: string,
  leadId: string,
  revoked: boolean,
): Promise<boolean> {
  const { rowCount } = await query(
    "UPDATE leads SET revoked = $1 WHERE event_id = $2 AND id = $3",
    [revoked, eventId, leadId],
  );
  return (rowCount ?? 0) > 0;
}

export async function setPhoto(
  eventId: string,
  leadId: string,
  photoUrl: string | null,
): Promise<void> {
  await query(
    "UPDATE leads SET photo_url = $1 WHERE event_id = $2 AND id = $3",
    [photoUrl, eventId, leadId],
  );
}

export async function setReferrer(
  eventId: string,
  leadId: string,
  referrerLeadId: string,
): Promise<void> {
  await query(
    "UPDATE leads SET referrer_lead_id = $1 WHERE event_id = $2 AND id = $3",
    [referrerLeadId, eventId, leadId],
  );
}
