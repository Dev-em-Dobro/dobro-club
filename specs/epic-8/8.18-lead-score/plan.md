# Implementation Plan: Lead score (pontuação de engajamento por lead)

**Branch**: `feat/8.18-lead-score` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.18-lead-score/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0.

## Summary

Calcula o **lead score por (lead, evento)** somando **pesos por tipo** dos `engagement_events` do lead —
**derivado no momento da leitura**, **sem** tabela/coluna de score (Const. VI: derivados em TS). Expõe
consultas atrás de `X-Api-Key`: **score de um lead** (com breakdown por tipo) e **ranking** dos leads de
um evento por score desc. Só **consome** o contrato de eventos (Const. IV); **nenhum** tipo novo na
taxonomia, **nenhuma** emissão.

Superfície (fina, sem tabela nova):
1. **`lib/score.ts`** (framework-agnostic): `WEIGHTS` (mapa `tipo→peso` versionado), regra pura
   `scoreFromCounts(counts)`, e as funções `getLeadScore(eventId, leadId)` → `{ score, breakdown }` e
   `listEventScores(eventId)` → ranking `[{ leadId, name, email, score }]`, ambas via `query()` com
   `GROUP BY` sobre `engagement_events` (peso aplicado em TS).
2. **Rotas admin (`X-Api-Key`)**:
   - `GET /api/events/[eventId]/leads/[leadId]/score` → score + breakdown de um lead.
   - `GET /api/events/[eventId]/scores` → ranking do evento.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, `pg`; reúso de `lib/` (`db`, `events`, `leads`, `engagement`).
**Sem novas dependências externas.**

**Storage**: PostgreSQL (Neon) via `query()`; `pg-mem` nos testes. **Sem tabela nova, sem coluna nova.**
Leitura por `GROUP BY (lead_id, type)` sobre `engagement_events` (+ `JOIN leads` no ranking p/ nome/email).
Peso aplicado **em TS**.

**Testing**: `vitest` + `pg-mem`. Regra pura (`scoreFromCounts`) e as funções de leitura (com eventos
seedados) testadas; Route Handlers de consulta invocados direto; `X-Api-Key` na borda.

**Target Platform**: Next single-origin. **Backend/consumo** — **sem tela nova**; mobile-first N/A.

**Performance Goals**: uma agregação por consulta (score de 1 lead: `GROUP BY type`; ranking: `GROUP BY
lead_id, type` no evento). Escala do piloto (milhares de leads) sem degradação perceptível.

**Constraints**: score **derivado na leitura** (sem persistir); **determinístico**; tipo sem peso ⇒ 0
(degradação segura); só consome eventos; `X-Api-Key` nas consultas; camada agnostic e pg-mem-safe
(`GROUP BY`/`COUNT`/`JOIN` são pg-mem-safe; sem FK/GENERATED).

**Scale/Scope**: 1 evento ativo, milhares de leads, ~8 tipos de evento. **1 lib + 2 Route Handlers +
testes + docs.**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Sem UI (backend/consumo) | ✅ atende (N/A de UI) |
| **II. Magic Link (sem senha)** | Não toca auth de lead; consulta é admin (`X-Api-Key`) | ✅ atende |
| **III. Ambiente Único** | Sem superfície de participante; nada redireciona | ✅ atende (N/A) |
| **IV. Tudo é Mensurado** | Consome `engagement_events` (o acoplamento permitido); **não** emite nem cria tipo | ✅ atende (reforça) |
| **V. Test-First / TDD** | Teste (vitest+pg-mem) antes; regra pura + leitura + rotas | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | Score derivado em TS; `query()` com GROUP BY/JOIN; sem FK/GENERATED; `X-Api-Key` | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.18-lead-score/` | ✅ atende |

**Sem violações.** Nenhuma entrada no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.18-lead-score/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/lead-score.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
lib/
└── score.ts   # NOVO — WEIGHTS (mapa tipo→peso); scoreFromCounts (pura);
                #        getLeadScore(eventId, leadId) → { score, breakdown };
                #        listEventScores(eventId) → ranking [{ leadId, name, email, score }]

app/api/events/[eventId]/leads/[leadId]/score/route.ts  # NOVO — GET score+breakdown de um lead (X-Api-Key)
app/api/events/[eventId]/scores/route.ts                # NOVO — GET ranking do evento (X-Api-Key)

tests/
├── score.rule.test.ts    # NOVO — scoreFromCounts: soma pesos; tipo sem peso ⇒ 0; determinístico; breakdown soma = total
├── score.query.test.ts   # NOVO — getLeadScore/listEventScores (pg-mem): soma por eventos; novo evento sobe; ranking desc + desempate; lead sem eventos ⇒ 0
└── score.route.test.ts   # NOVO — rotas: 401 sem/errada X-Api-Key; 200 score+breakdown; 200 ranking ordenado
```

**Tabela de pesos** (versionada em `lib/score.ts`, valores definidos no research — não é config de DB
nesta story). **Consumo** por `X-Api-Key` (automação/admin), sem admin UI (8.9).

**Structure Decision**: **Next.js App Router em TS**, single-origin. Reúso total do contrato de eventos.
Story **read-only/consumo**: uma lib de pontuação (pesos + agregação em TS) e duas rotas de leitura
protegidas. Nenhuma tabela, nenhuma emissão, nenhuma tela — o menor recorte que entrega score + ranking +
breakdown.

## Complexity Tracking

> Sem violações constitucionais — seção vazia.
