// Conteúdo dia-1 (Story 8.14): aulas de nivelamento, docs e acesso ao CodeQuest
// num modelo único `content_items` com discriminador `kind`. Camada
// framework-agnostic e pg-mem-safe: id texto (`newId`), sem FK, `release_at`
// avaliado em TS (drip), snake↔camel na borda.

import { query } from "./db";
import { newId } from "./leads";

export type ContentKind = "lesson" | "doc" | "codequest";
export const CONTENT_KINDS: ContentKind[] = ["lesson", "doc", "codequest"];

export interface ContentItem {
  id: string;
  eventId: string;
  kind: ContentKind;
  title: string;
  description: string | null;
  resource: string | null;
  isGift: boolean;
  releaseAt: string | null;
  position: number | null;
  createdAt: string | null;
}

interface ContentRow {
  id: string;
  event_id: string;
  kind: string;
  title: string;
  description: string | null;
  resource: string | null;
  is_gift: boolean;
  release_at: string | null;
  position: number | null;
  created_at: string | null;
}

function mapContentItem(row: ContentRow | undefined): ContentItem | null {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    kind: row.kind as ContentKind,
    title: row.title,
    description: row.description,
    resource: row.resource,
    isGift: row.is_gift,
    releaseAt: row.release_at,
    position: row.position,
    createdAt: row.created_at,
  };
}

/**
 * Liberação drip: um item está liberado quando não tem data (`releaseAt` null)
 * ou a data já chegou. Data inválida é tratada como liberada (não trava conteúdo
 * por dado ruim). Não confundir com o gate da pesquisa — são condições distintas.
 */
export function isReleased(
  item: Pick<ContentItem, "releaseAt">,
  now: Date = new Date(),
): boolean {
  if (!item.releaseAt) return true;
  const at = new Date(item.releaseAt);
  if (Number.isNaN(at.getTime())) return true;
  return now.getTime() >= at.getTime();
}

const SELECT = `SELECT id, event_id, kind, title, description, resource,
        is_gift, release_at, position, created_at
   FROM content_items`;

/** Itens do evento, ordenados por kind, position (nulls por último) e criação. */
export async function listContentItems(eventId: string): Promise<ContentItem[]> {
  const { rows } = await query<ContentRow>(
    `${SELECT} WHERE event_id = $1
     ORDER BY kind, position NULLS LAST, created_at`,
    [eventId],
  );
  return rows.map((r) => mapContentItem(r)!);
}

export async function getContentItem(
  eventId: string,
  id: string,
): Promise<ContentItem | null> {
  const { rows } = await query<ContentRow>(
    `${SELECT} WHERE event_id = $1 AND id = $2`,
    [eventId, id],
  );
  return mapContentItem(rows[0]);
}

export interface ContentInput {
  kind: string;
  title: string;
  description?: string | null;
  resource?: string | null;
  isGift?: boolean;
  releaseAt?: string | null;
  position?: number | null;
}

export class ContentValidationError extends Error {}

/** Cria um item validando `kind`/`title` em TS (sem enum no DB, pg-mem-safe). */
export async function createContentItem(
  eventId: string,
  input: ContentInput,
): Promise<ContentItem> {
  if (!CONTENT_KINDS.includes(input.kind as ContentKind)) {
    throw new ContentValidationError("kind inválido");
  }
  if (!input.title || !input.title.trim()) {
    throw new ContentValidationError("title obrigatório");
  }
  const row = {
    id: newId("cont"),
    event_id: eventId,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description ?? null,
    resource: input.resource ?? null,
    is_gift: input.isGift ?? false,
    release_at: input.releaseAt ?? null,
    position: input.position ?? null,
    created_at: new Date().toISOString(),
  };
  const { rows } = await query<ContentRow>(
    `INSERT INTO content_items
       (id, event_id, kind, title, description, resource, is_gift, release_at, position, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      row.id,
      row.event_id,
      row.kind,
      row.title,
      row.description,
      row.resource,
      row.is_gift,
      row.release_at,
      row.position,
      row.created_at,
    ],
  );
  return mapContentItem(rows[0])!;
}
