// Lives de aquecimento (Story 8.17): eventos ao vivo pré-evento, mockados, num
// modelo PRÓPRIO `lives` (separado do conteúdo dia-1 da 8.14). Camada
// framework-agnostic e pg-mem-safe: id texto (`newId`), sem FK, estado derivado
// em TS a partir de início + duração, snake↔camel na borda.
//
// Estado (agendada → ao vivo → gravação → encerrada) NÃO é persistido: é
// calculado na leitura por `liveState(live, now)`. Assistível = live | recording.

import { query } from "./db";
import { newId } from "./leads";

export type LiveState = "scheduled" | "live" | "recording" | "ended";

export const DEFAULT_DURATION_MIN = 90;

export interface Live {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  durationMin: number | null;
  streamUrl: string | null;
  recordingUrl: string | null;
  position: number | null;
  createdAt: string | null;
}

interface LiveRow {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  duration_min: number | null;
  stream_url: string | null;
  recording_url: string | null;
  position: number | null;
  created_at: string | null;
}

function mapLive(row: LiveRow | undefined): Live | null {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    durationMin: row.duration_min,
    streamUrl: row.stream_url,
    recordingUrl: row.recording_url,
    position: row.position,
    createdAt: row.created_at,
  };
}

/** Duração saneada em minutos: inteiro > 0; ausente/inválido ⇒ default (90). */
export function sanitizeDuration(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : DEFAULT_DURATION_MIN;
}

/**
 * Estado da live derivado do horário (Story 8.17): antes do início ⇒ `scheduled`;
 * dentro de [início, início+duração] ⇒ `live`; depois ⇒ `recording` (se há
 * gravação) ou `ended`. Início inválido/ausente ⇒ `scheduled` (degradação segura).
 */
export function liveState(
  live: Pick<Live, "startsAt" | "durationMin" | "recordingUrl">,
  now: Date = new Date(),
): LiveState {
  if (!live.startsAt) return "scheduled";
  const start = new Date(live.startsAt);
  if (Number.isNaN(start.getTime())) return "scheduled";
  const end = start.getTime() + sanitizeDuration(live.durationMin) * 60_000;
  if (now.getTime() < start.getTime()) return "scheduled";
  if (now.getTime() <= end) return "live";
  return live.recordingUrl ? "recording" : "ended";
}

/** Assistível apenas quando ao vivo ou com gravação disponível. */
export function isWatchable(state: LiveState): boolean {
  return state === "live" || state === "recording";
}

/** Embed a devolver conforme o estado: transmissão (live) / gravação (recording). */
export function watchResource(
  live: Pick<Live, "streamUrl" | "recordingUrl">,
  state: LiveState,
): string | null {
  if (state === "live") return live.streamUrl;
  if (state === "recording") return live.recordingUrl;
  return null;
}

const SELECT = `SELECT id, event_id, title, description, starts_at,
        duration_min, stream_url, recording_url, position, created_at
   FROM lives`;

/** Lives do evento, ordenadas por position (nulls por último), início e criação. */
export async function listLives(eventId: string): Promise<Live[]> {
  const { rows } = await query<LiveRow>(
    `${SELECT} WHERE event_id = $1
     ORDER BY position NULLS LAST, starts_at NULLS LAST, created_at`,
    [eventId],
  );
  return rows.map((r) => mapLive(r)!);
}

export async function getLive(eventId: string, id: string): Promise<Live | null> {
  const { rows } = await query<LiveRow>(
    `${SELECT} WHERE event_id = $1 AND id = $2`,
    [eventId, id],
  );
  return mapLive(rows[0]);
}

export interface LiveInput {
  title: string;
  description?: string | null;
  startsAt?: string | null;
  durationMin?: number | null;
  streamUrl?: string | null;
  recordingUrl?: string | null;
  position?: number | null;
}

export class LiveValidationError extends Error {}

/** Cria uma live validando `title` em TS (sem enum no DB, pg-mem-safe). */
export async function createLive(eventId: string, input: LiveInput): Promise<Live> {
  if (!input.title || !input.title.trim()) {
    throw new LiveValidationError("title obrigatório");
  }
  const row = {
    id: newId("live"),
    event_id: eventId,
    title: input.title.trim(),
    description: input.description ?? null,
    starts_at: input.startsAt ?? null,
    duration_min: input.durationMin ?? null,
    stream_url: input.streamUrl ?? null,
    recording_url: input.recordingUrl ?? null,
    position: input.position ?? null,
    created_at: new Date().toISOString(),
  };
  const { rows } = await query<LiveRow>(
    `INSERT INTO lives
       (id, event_id, title, description, starts_at, duration_min, stream_url, recording_url, position, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      row.id,
      row.event_id,
      row.title,
      row.description,
      row.starts_at,
      row.duration_min,
      row.stream_url,
      row.recording_url,
      row.position,
      row.created_at,
    ],
  );
  return mapLive(rows[0])!;
}
