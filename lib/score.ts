// Lead score (Story 8.18 = "8.8 Lead Scoring" do épico): pontuação de engajamento
// por (lead, evento), DERIVADA dos engagement_events na leitura (sem tabela/coluna
// de score — Const. VI: derivados em TS). Só CONSOME o contrato de eventos
// (Const. IV); não emite nem cria tipo. Pesos versionados aqui, ajustáveis por deploy.

import { query } from "./db";

/**
 * Peso por tipo de evento (taxonomia FROZEN, CONTRIBUTING §3). Ordena
 * intenção/ação acima de presença. Tipo ausente ⇒ 0 (degradação segura).
 */
export const WEIGHTS: Record<string, number> = {
  "survey.completed": 10,
  "referral.signup": 8,
  "lesson.completed": 6,
  "live.opened": 5,
  "ticket.shared": 4,
  "lesson.started": 3,
  "content.opened": 2,
  "hub.viewed": 1,
};

export function weightOf(type: string): number {
  return WEIGHTS[type] ?? 0;
}

export interface TypeCount {
  type: string;
  count: number;
}

export interface BreakdownItem {
  type: string;
  count: number;
  weight: number;
  points: number;
}

export interface LeadScore {
  leadId: string;
  score: number;
  breakdown: BreakdownItem[];
}

export interface RankedLead {
  leadId: string;
  name: string | null;
  email: string | null;
  score: number;
}

/**
 * Regra pura: dado o número de eventos por tipo, devolve o score (soma de
 * `peso × contagem`) e o breakdown por tipo. Determinístico; `sum(points) === score`.
 */
export function scoreFromCounts(counts: TypeCount[]): {
  score: number;
  breakdown: BreakdownItem[];
} {
  const breakdown = counts.map((c) => {
    const weight = weightOf(c.type);
    return { type: c.type, count: c.count, weight, points: weight * c.count };
  });
  const score = breakdown.reduce((s, b) => s + b.points, 0);
  return { score, breakdown };
}

interface CountRow {
  type: string;
  n: string | number;
}

/**
 * Score de um lead num evento (derivado na leitura). Lead sem eventos / fora do
 * evento ⇒ `{ score: 0, breakdown: [] }` (degradação segura).
 */
export async function getLeadScore(
  eventId: string,
  leadId: string,
): Promise<LeadScore> {
  const { rows } = await query<CountRow>(
    `SELECT type, COUNT(*) AS n FROM engagement_events
      WHERE event_id = $1 AND lead_id = $2
      GROUP BY type`,
    [eventId, leadId],
  );
  const counts = rows.map((r) => ({ type: r.type, count: Number(r.n) }));
  return { leadId, ...scoreFromCounts(counts) };
}

interface LeadTypeRow {
  lead_id: string;
  type: string;
  n: string | number;
  name: string | null;
  email: string | null;
}

/**
 * Ranking dos leads de um evento por score desc (desempate por leadId asc,
 * estável). Inclui os leads com ≥1 evento; evento sem eventos ⇒ `[]`.
 */
export async function listEventScores(eventId: string): Promise<RankedLead[]> {
  const { rows } = await query<LeadTypeRow>(
    `SELECT e.lead_id, e.type, COUNT(*) AS n, l.name, l.email
       FROM engagement_events e
       JOIN leads l ON l.id = e.lead_id
      WHERE e.event_id = $1 AND e.lead_id IS NOT NULL
      GROUP BY e.lead_id, e.type, l.name, l.email`,
    [eventId],
  );

  const byLead = new Map<string, { name: string | null; email: string | null; counts: TypeCount[] }>();
  for (const r of rows) {
    const entry =
      byLead.get(r.lead_id) ?? { name: r.name, email: r.email, counts: [] };
    entry.counts.push({ type: r.type, count: Number(r.n) });
    byLead.set(r.lead_id, entry);
  }

  const ranked: RankedLead[] = [...byLead.entries()].map(([leadId, e]) => ({
    leadId,
    name: e.name,
    email: e.email,
    score: scoreFromCounts(e.counts).score,
  }));

  ranked.sort((a, b) => b.score - a.score || (a.leadId < b.leadId ? -1 : a.leadId > b.leadId ? 1 : 0));
  return ranked;
}
