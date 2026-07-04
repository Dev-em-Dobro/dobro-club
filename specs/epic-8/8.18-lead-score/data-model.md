# Phase 1 — Data Model: Lead score

**Sem tabela nova, sem coluna nova.** Score é **derivado** de `engagement_events`. Reúso de `leads`.

## Entidades

### `engagement_events` (REÚSO — fonte única)

- Já existe (id, event_id, lead_id, type, data, created_at). O score lê **apenas** este contrato
  (Const. IV). Sem alteração.
- Consultas:
  - por lead: `WHERE event_id=$1 AND lead_id=$2 GROUP BY type`.
  - ranking: `... JOIN leads ... WHERE event_id=$1 AND lead_id IS NOT NULL GROUP BY lead_id, type, name, email`.

### `leads` (REÚSO — nome/email no ranking)

- `JOIN` para enriquecer o ranking com `name`/`email`. Sem alteração de schema.

### Peso por tipo (constante versionada — `lib/score.ts`)

`WEIGHTS: Record<string, number>` (ver research D1). Tipo ausente ⇒ **0**.

## Tipos derivados (em TypeScript — `lib/score.ts`)

```
type TypeCount = { type: string; count: number };
type BreakdownItem = { type: string; count: number; weight: number; points: number };
type LeadScore = { leadId: string; score: number; breakdown: BreakdownItem[] };
type RankedLead = { leadId: string; name: string | null; email: string | null; score: number };

WEIGHTS: Record<string, number>   // survey.completed:10, referral.signup:8, lesson.completed:6,
                                   // live.opened:5, ticket.shared:4, lesson.started:3,
                                   // content.opened:2, hub.viewed:1

weightOf(type) = WEIGHTS[type] ?? 0

scoreFromCounts(counts: TypeCount[]):
    breakdown = counts.map(c => ({ type:c.type, count:c.count,
                                   weight: weightOf(c.type),
                                   points: weightOf(c.type) * c.count }))
    score = sum(breakdown.points)
    return { score, breakdown }        // determinístico (soma independe de ordem)
```

## Funções de leitura (em `lib/score.ts`)

```
getLeadScore(eventId, leadId) -> LeadScore
    counts = query(GROUP BY type para o lead)   // [] se lead sem eventos / fora do evento
    return { leadId, ...scoreFromCounts(counts) }   // score 0, breakdown [] no caso vazio

listEventScores(eventId) -> RankedLead[]
    rows = query(GROUP BY lead_id,type + JOIN leads)   // [] se evento sem eventos
    agrupa por leadId, aplica scoreFromCounts, monta RankedLead
    ordena por score desc, empate por leadId asc        // FR-005 desempate estável
```

## Validação / invariantes

- **Determinismo** (FR-004/SC-003): o mesmo conjunto de eventos ⇒ mesmo score.
- **Breakdown soma = score** (FR-006/SC-005): `sum(points) === score` sempre.
- **Peso ausente ⇒ 0** (FR-002/SC-007): nunca lança; contribuição 0 (contagem pode aparecer).
- **Escopo por (lead, evento)**: filtros por `event_id` (+ `lead_id`) garantem isolamento entre eventos.
