// Conteúdo dia-1 (Story 8.14): aulas de nivelamento e docs num modelo único
// `content_items` com discriminador `kind`. Camada
// framework-agnostic e pg-mem-safe: id texto (`newId`), sem FK, `release_at`
// avaliado em TS (drip), snake↔camel na borda.
//
// Story 8.16 — liberação progressiva por lead: `release_offset_days` (int) define,
// para `kind='lesson'`, quantos dias após a **entrada do lead** (`leads.created_at`)
// a aula abre. Precedência: para aulas o modo por-lead PREVALECE sobre `release_at`
// (que segue governando docs por calendário). `null`/inválido ⇒ offset 0;
// entrada inválida/ausente ⇒ tratada como "agora". Ver isItemReleasedForLead.

import { query } from "./db";
import { newId } from "./leads";

export type ContentKind = "lesson" | "doc";
export const CONTENT_KINDS: ContentKind[] = ["lesson", "doc"];

export interface ContentItem {
  id: string;
  eventId: string;
  kind: ContentKind;
  title: string;
  description: string | null;
  resource: string | null;
  isGift: boolean;
  /**
   * Conteúdo aberto: ignora o gate (Mestre + pesquisa) e a liberação drip —
   * fica sempre disponível, inclusive para visitante anônimo. Ver `abrir`.
   */
  isFree: boolean;
  releaseAt: string | null;
  /**
   * Story 8.16: dias após a **entrada do lead** para liberar (aplica-se a
   * `kind='lesson'`). `null`/inválido ⇒ tratado como 0. Ver `isLessonReleasedForLead`.
   */
  releaseOffsetDays: number | null;
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
  is_free: boolean | null;
  release_at: string | null;
  release_offset_days: number | null;
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
    isFree: !!row.is_free,
    releaseAt: row.release_at,
    releaseOffsetDays: row.release_offset_days,
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Offset saneado: inteiro ≥ 0; ausente/negativo/NaN ⇒ 0 (Story 8.16, D4). */
export function sanitizeOffset(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Data de entrada válida do lead ou `now` (degradação segura, Story 8.16 D5):
 * dado ruim nunca trava todo o nivelamento — a trilha só começa "de agora".
 */
function entryOrNow(leadEntryDate: string | null | undefined, now: Date): Date {
  if (!leadEntryDate) return now;
  const d = new Date(leadEntryDate);
  return Number.isNaN(d.getTime()) ? now : d;
}

/**
 * Liberação por-lead de uma **aula** (Story 8.16): liberada quando
 * `now >= entrada_do_lead + offset_dias`. Puramente por tempo — não exige
 * concluir a aula anterior.
 */
export function isLessonReleasedForLead(
  item: Pick<ContentItem, "releaseOffsetDays">,
  leadEntryDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const base = entryOrNow(leadEntryDate, now);
  return now.getTime() >= base.getTime() + sanitizeOffset(item.releaseOffsetDays) * DAY_MS;
}

/**
 * Seletor de precedência (Story 8.16 D3): para `kind='lesson'` vale a liberação
 * **por-lead** (offset × entrada); para os demais kinds mantém o drip por
 * **calendário** da 8.14 (`isReleased`).
 */
export function isItemReleasedForLead(
  item: Pick<ContentItem, "kind" | "releaseOffsetDays" | "releaseAt">,
  leadEntryDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return item.kind === "lesson"
    ? isLessonReleasedForLead(item, leadEntryDate, now)
    : isReleased(item, now);
}

/**
 * Data prevista de liberação para ESTE lead, usada no rótulo "em breve":
 * aula ⇒ `entrada + offset*dia`; demais kinds ⇒ o `releaseAt` de calendário.
 */
export function releaseForLeadAt(
  item: Pick<ContentItem, "kind" | "releaseOffsetDays" | "releaseAt">,
  leadEntryDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (item.kind !== "lesson") return item.releaseAt;
  const base = entryOrNow(leadEntryDate, now);
  return new Date(base.getTime() + sanitizeOffset(item.releaseOffsetDays) * DAY_MS).toISOString();
}

const SELECT = `SELECT id, event_id, kind, title, description, resource,
        is_gift, is_free, release_at, release_offset_days, position, created_at
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
  /** Conteúdo aberto: ignora o gate e a liberação (default false). */
  isFree?: boolean;
  releaseAt?: string | null;
  /** Story 8.16: dias após a entrada do lead p/ liberar (aulas). Ausente ⇒ null ⇒ tratado como 0. */
  releaseOffsetDays?: number | null;
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
    is_free: input.isFree ?? false,
    release_at: input.releaseAt ?? null,
    release_offset_days: input.releaseOffsetDays ?? null,
    position: input.position ?? null,
    created_at: new Date().toISOString(),
  };
  const { rows } = await query<ContentRow>(
    `INSERT INTO content_items
       (id, event_id, kind, title, description, resource, is_gift, is_free, release_at, release_offset_days, position, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      row.id,
      row.event_id,
      row.kind,
      row.title,
      row.description,
      row.resource,
      row.is_gift,
      row.is_free,
      row.release_at,
      row.release_offset_days,
      row.position,
      row.created_at,
    ],
  );
  return mapContentItem(rows[0])!;
}
