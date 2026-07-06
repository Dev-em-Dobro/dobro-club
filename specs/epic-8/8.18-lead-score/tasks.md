---
description: "Task list for Story 8.18 — Lead score (pontuação de engajamento por lead)"
---

# Tasks: Lead score (pontuação de engajamento por lead)

**Input**: Design documents from `specs/epic-8/8.18-lead-score/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/lead-score.md, quickstart.md

**Tests**: INCLUÍDOS — TDD não-negociável (Constituição V). Teste escrito **antes** e **falhando** antes
da implementação.

**Organization**: por user story (US1 score de 1 lead P1, US2 ranking P2, US3 breakdown P3). Story de
**consumo/read-only**: deriva o score de `engagement_events`; **sem tabela, sem emissão, sem tela**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3; Setup/Foundational/Polish sem label
- Caminhos reais em cada tarefa. App **Next.js App Router + TS** (`app/`, `lib/`, `tests/`).

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs reusadas
  (`lib/db.ts` com `query`, `lib/engagement.ts` com `emit`/`EngagementType`, `lib/events.ts` com
  `getEvent`/`verifyApiKey`, `lib/leads.ts` com `createOrGetLead`) — pré-condição TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a lib de pontuação (pesos + regra pura) — **todas** as stories dependem dela.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 [P] Escrever teste (deve FALHAR) `tests/score.rule.test.ts`: `scoreFromCounts` soma
  `weight×count` por tipo e `sum(points) === score`; tipo sem peso ⇒ `weight:0, points:0`;
  determinístico (mesma entrada em qualquer ordem ⇒ mesmo score); `WEIGHTS` cobre os 8 tipos da
  taxonomia (survey.completed, referral.signup, lesson.completed, live.opened, ticket.shared,
  lesson.started, content.opened, hub.viewed)
- [X] T003 Criar `lib/score.ts` (framework-agnostic): `WEIGHTS: Record<string, number>` conforme
  research D1; tipos `TypeCount`/`BreakdownItem`/`LeadScore`/`RankedLead`; `weightOf(type)=WEIGHTS[type]
  ?? 0`; `scoreFromCounts(counts)` → `{ score, breakdown }` — até `tests/score.rule.test.ts` passar

**Checkpoint**: pesos versionados + regra pura testada; base para as consultas.

---

## Phase 3: User Story 1 - Calcular o score de um lead (Priority: P1) 🎯 MVP

**Goal**: dado (evento, lead), devolver o score = soma dos pesos dos eventos do lead, com breakdown;
recalcula na leitura; lead sem eventos ⇒ 0.

**Independent Test**: seedar eventos de um lead (via `emit`), consultar o score e conferir a soma;
adicionar um evento de peso P e conferir que sobe P; lead sem eventos ⇒ `{score:0, breakdown:[]}`.

### Tests for User Story 1 (TDD — escrever FIRST) ⚠️

- [X] T004 [US1] Escrever teste (deve FALHAR) `tests/score.query.test.ts` (parte getLeadScore, pg-mem +
  `emit`): soma os eventos do lead no evento; adicionar 1 evento de peso P ⇒ score sobe P; lead sem
  eventos / fora do evento ⇒ `{score:0, breakdown:[]}`; isolamento por `event_id` (evento de outro
  evento não conta); tipo sem peso ⇒ contribui 0
- [X] T005 [US1] Escrever teste (deve FALHAR) `tests/score.route.test.ts` (parte lead): `GET
  /api/events/[eventId]/leads/[leadId]/score` ⇒ `401` sem/`X-Api-Key` errada; `404` evento inexistente;
  `200` com `{ leadId, score, breakdown }` e `sum(points)===score`

### Implementation for User Story 1

- [X] T006 [US1] Adicionar `getLeadScore(eventId, leadId)` a `lib/score.ts`: `query` `SELECT type,
  COUNT(*) n FROM engagement_events WHERE event_id=$1 AND lead_id=$2 GROUP BY type`; aplicar
  `scoreFromCounts`; devolver `{ leadId, score, breakdown }` — até `T004` passar
- [X] T007 [US1] Criar `app/api/events/[eventId]/leads/[leadId]/score/route.ts` (`GET`): validar
  eventId, `getEvent` (404), `verifyApiKey` (401), `getLeadScore` ⇒ `200` — espelha o padrão admin das
  rotas de provisionamento — até `T005` passar

**Checkpoint**: US1 funcional — MVP: score de qualquer lead consultável e correto.

---

## Phase 4: User Story 2 - Ranquear os leads de um evento (Priority: P2)

**Goal**: listar os leads do evento (com ≥1 evento) ordenados por score desc, com nome/email.

**Independent Test**: vários leads com scores distintos ⇒ lista ordenada desc; empate ⇒ leadId asc;
evento sem eventos ⇒ `[]`.

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T008 [US2] Adicionar a `tests/score.query.test.ts` (parte listEventScores, deve FALHAR):
  vários leads ⇒ ordenado por score desc; empate ⇒ `leadId` asc (estável); inclui `name`/`email`;
  evento sem eventos ⇒ `[]`; isolamento por `event_id`
- [X] T009 [US2] Adicionar a `tests/score.route.test.ts` (parte ranking, deve FALHAR): `GET
  /api/events/[eventId]/scores` ⇒ `401` sem/`X-Api-Key` errada; `404` evento inexistente; `200
  { scores }` ordenado

### Implementation for User Story 2

- [X] T010 [US2] Adicionar `listEventScores(eventId)` a `lib/score.ts`: `query` `SELECT e.lead_id,
  e.type, COUNT(*) n, l.name, l.email FROM engagement_events e JOIN leads l ON l.id=e.lead_id WHERE
  e.event_id=$1 AND e.lead_id IS NOT NULL GROUP BY e.lead_id, e.type, l.name, l.email`; agrupar por lead
  em TS, `scoreFromCounts`, ordenar por score desc / leadId asc — até `T008` passar
- [X] T011 [US2] Criar `app/api/events/[eventId]/scores/route.ts` (`GET`): validar eventId, `getEvent`
  (404), `verifyApiKey` (401), `listEventScores` ⇒ `200 { scores }` — até `T009` passar

**Checkpoint**: US1+US2 verdes; priorização por ranking disponível.

---

## Phase 5: User Story 3 - Transparência do score (breakdown) (Priority: P3)

**Goal**: o breakdown por tipo (contagem + contribuição) acompanha o score e sua soma bate com o total.

**Independent Test**: lead com tipos variados ⇒ breakdown com contagem/contribuição por tipo; soma das
contribuições = score; tipo sem peso ⇒ contribuição 0.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T012 [US3] Adicionar a `tests/score.query.test.ts` (deve FALHAR se faltar): o `breakdown` de
  `getLeadScore` traz `{type,count,weight,points}` por tipo presente; `sum(points)===score`; tipo sem
  peso aparece com `weight:0, points:0` (contagem visível)

### Implementation for User Story 3

- [X] T013 [US3] Confirmar em `lib/score.ts` que `scoreFromCounts`/`getLeadScore` já retornam o
  `breakdown` completo (herdado de T003/T006); ajustar apenas se `T012` acusar lacuna — sem regressão
  em US1/US2

**Checkpoint**: as três stories independentemente verdes; score explicável.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] Documentar o lead score em `CONTRIBUTING.md §3` (consumidor `8.18` do contrato de
  eventos; tabela de pesos versionada em `lib/score.ts`; score derivado/não persistido; consulta por
  `X-Api-Key`) — para o consumo não virar conhecimento tácito
- [X] T015 Rodar o roteiro de `specs/epic-8/8.18-lead-score/quickstart.md` ponta a ponta, confirmar
  `npm test` **verde** e `tsc --noEmit` limpo (sem tabela nova, sem novo tipo de evento)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** → **User Stories** → **Polish (T014–T015)**.
- **Foundational bloqueia tudo**: T002 (teste) antes de T003 (lib); a regra pura é pré-requisito das
  consultas.
- **US1 (T004–T007)** é o MVP; não depende de US2/US3.
- **US2 (T008–T011)** depende de US1 (compartilha `lib/score.ts` e os arquivos de teste query/route).
- **US3 (T012–T013)** depende de US1 (breakdown já vem de `scoreFromCounts`).
- **Polish** por último.

### Ordem de arquivos (mesma-file ⇒ sequencial)

- `lib/score.ts`: T003 → T006 → T010 (→ T013 confirma).
- `tests/score.query.test.ts`: T004 → T008 → T012 (mesmo arquivo).
- `tests/score.route.test.ts`: T005 → T009 (mesmo arquivo).
- Rotas em arquivos distintos (T007, T011) ⇒ paralelizáveis entre si após suas libs.

## Parallel Opportunities

- **T002 [P]** (teste da regra) pode ser escrito enquanto se planeja a lib.
- **T014 [P]** (docs) em paralelo no Polish.
- Rotas T007 e T011 tocam arquivos distintos ⇒ paralelizáveis (após T006/T010 respectivamente).

## Independent Test Criteria

- **US1**: score = soma dos pesos; +evento de peso P ⇒ +P; lead sem eventos ⇒ 0; rota protegida.
- **US2**: ranking ordenado desc, desempate estável; evento vazio ⇒ [].
- **US3**: breakdown por tipo; soma das contribuições = score total.

## Implementation Strategy

- **MVP = US1** (T001–T007): score de qualquer lead — o valor central de priorização.
- **Incremento 1 = US2** (ranking) e **Incremento 2 = US3** (breakdown), ambos finos sobre a mesma lib.
- Entregar em PR pequeno; `npm test` verde obrigatório (Const. V); sem tabela/tipo novo.
