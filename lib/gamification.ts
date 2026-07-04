// Streak e badges de engajamento (Story 8.19): gamificação DERIVADA dos
// engagement_events + lead score (8.18), sem persistência (Const. VI). Só CONSOME
// o contrato de eventos (Const. IV); não emite nem cria tipo. Catálogo e fuso
// versionados aqui, ajustáveis por deploy.

import { query } from "./db";
import { getLeadScore } from "./score";

/** Offset do "dia" em minutos — São Paulo (UTC-3, sem DST). Bucket de dia em TS. */
export const DAY_TZ_OFFSET_MIN = -180;

/** Tipos que caracterizam um "dia ativo" (consumo de conteúdo). */
export const ACTIVE_TYPES = ["content.opened", "live.opened"];

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Streak {
  current: number;
  longest: number;
}

export interface BadgeCtx {
  counts: Record<string, number>;
  streak: Streak;
  score: number;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  criterion: string;
  test: (ctx: BadgeCtx) => boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  criterion: string;
  earned: boolean;
}

export interface LeadGamification {
  streak: Streak;
  badges: Badge[];
}

/** Dia de calendário (YYYY-MM-DD) no fuso do evento a partir de um ISO UTC. */
export function dayKey(iso: string, offsetMin: number = DAY_TZ_OFFSET_MIN): string {
  return new Date(new Date(iso).getTime() + offsetMin * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Soma `n` dias a uma chave 'YYYY-MM-DD' (aritmética em UTC). */
function addDays(key: string, n: number): string {
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * Streak a partir dos dias ativos (dedup): `longest` = maior sequência de dias
 * consecutivos no histórico; `current` = sequência que termina em **hoje** ou
 * **ontem** (tolerância D3) — 0 se o último dia ativo for anterior a ontem.
 */
export function computeStreak(dayKeys: string[], today: Date = new Date()): Streak {
  const set = new Set(dayKeys);
  if (set.size === 0) return { current: 0, longest: 0 };

  const sorted = [...set].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDays(sorted[i - 1], 1) ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const todayKey = dayKey(today.toISOString());
  const yesterdayKey = addDays(todayKey, -1);
  let anchor: string | null = set.has(todayKey)
    ? todayKey
    : set.has(yesterdayKey)
      ? yesterdayKey
      : null;
  let current = 0;
  while (anchor && set.has(anchor)) {
    current++;
    anchor = addDays(anchor, -1);
  }

  return { current, longest };
}

/** Catálogo de badges (regras fixas versionadas). Ver research D4. */
export const BADGES: BadgeDef[] = [
  {
    id: "primeira-live",
    name: "Primeira live",
    description: "Você entrou na sua primeira live de aquecimento.",
    criterion: "Assista a 1 live",
    test: (c) => (c.counts["live.opened"] ?? 0) >= 1,
  },
  {
    id: "explorador",
    name: "Explorador de conteúdo",
    description: "Você abriu 5 conteúdos do aquecimento.",
    criterion: "Abra 5 conteúdos",
    test: (c) => (c.counts["content.opened"] ?? 0) >= 5,
  },
  {
    id: "streak-3",
    name: "3 dias seguidos",
    description: "Você manteve 3 dias seguidos de atividade.",
    criterion: "Fique ativo 3 dias seguidos",
    test: (c) => c.streak.longest >= 3,
  },
  {
    id: "streak-7",
    name: "7 dias seguidos",
    description: "Você manteve 7 dias seguidos de atividade.",
    criterion: "Fique ativo 7 dias seguidos",
    test: (c) => c.streak.longest >= 7,
  },
  {
    id: "engajado",
    name: "Engajado",
    description: "Seu engajamento no evento está alto.",
    criterion: "Alcance 20 pontos de engajamento",
    test: (c) => c.score >= 20,
  },
];

/** Avalia o catálogo para um contexto; erro em um `test` ⇒ `earned:false` (isolado). */
export function evaluateBadges(ctx: BadgeCtx): Badge[] {
  return BADGES.map((b) => {
    let earned = false;
    try {
      earned = b.test(ctx);
    } catch {
      earned = false;
    }
    return {
      id: b.id,
      name: b.name,
      description: b.description,
      criterion: b.criterion,
      earned,
    };
  });
}

interface ActivityRow {
  type: string;
  created_at: string | null;
}

/**
 * Streak + badges de um lead num evento (derivado na leitura). Lead sem eventos
 * ⇒ streak {0,0} e nenhum badge conquistado (degradação segura).
 */
export async function getLeadGamification(
  eventId: string,
  leadId: string,
  now: Date = new Date(),
): Promise<LeadGamification> {
  const { rows } = await query<ActivityRow>(
    `SELECT type, created_at FROM engagement_events
      WHERE event_id = $1 AND lead_id = $2`,
    [eventId, leadId],
  );

  const counts: Record<string, number> = {};
  const dayKeys: string[] = [];
  for (const r of rows) {
    counts[r.type] = (counts[r.type] ?? 0) + 1;
    if (r.created_at && ACTIVE_TYPES.includes(r.type)) {
      dayKeys.push(dayKey(r.created_at));
    }
  }

  const streak = computeStreak(dayKeys, now);
  const { score } = await getLeadScore(eventId, leadId);
  const badges = evaluateBadges({ counts, streak, score });

  return { streak, badges };
}
