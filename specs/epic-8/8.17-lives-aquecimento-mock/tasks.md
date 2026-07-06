---
description: "Task list for Story 8.17 — Lives de aquecimento (mockadas) com agenda e medição"
---

# Tasks: Lives de aquecimento (mockadas) com agenda e medição de engajamento

**Input**: Design documents from `specs/epic-8/8.17-lives-aquecimento-mock/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/lives-aquecimento.md, quickstart.md

**Tests**: INCLUÍDOS — TDD não-negociável (Constituição V). Teste escrito **antes** e **falhando** antes
da implementação.

**Organization**: por user story (US1 agenda+estados P1, US2 assistir+medir P2, US3 provisionamento P3).
Modelo **próprio** (`lives`), estado derivado em TS; rotas espelham o padrão de conteúdo da 8.14.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3; Setup/Foundational/Polish sem label
- Caminhos reais em cada tarefa. App **Next.js App Router + TS** (`app/`, `lib/`, `tests/`).

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs reusadas
  (`lib/engagement.ts` com `emit`/`hasCompletedSurvey`/`EngagementType`, `lib/leads.ts` com
  `getLeadById`/`newId`, `lib/events.ts` com `getEvent`/`verifyApiKey`, `lib/auth/session.ts` com
  `verifySession`/`COOKIE`) — pré-condição TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tabela `lives`, tipo `live.opened` e a lib de estado — **todas** as stories dependem disto.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 Adicionar `CREATE TABLE IF NOT EXISTS lives (...)` ao `SCHEMA` em `lib/db.ts` conforme
  `data-model.md` (id text PK, event_id text NOT NULL, title text NOT NULL, description text, starts_at
  timestamptz, duration_min int, stream_url text, recording_url text, position int, created_at
  timestamptz) + `CREATE INDEX IF NOT EXISTS idx_lives_event ON lives(event_id)` — pg-mem-safe (sem
  FK/GENERATED/índice parcial)
- [X] T003 [P] Adicionar `'live.opened'` ao `EngagementType` em `lib/engagement.ts` (com comentário
  "Emitido pela Story 8.17 ao abrir uma live assistível")
- [X] T004 [P] Escrever teste (deve FALHAR) `tests/lives.state.test.ts`: `liveState` (futuro ⇒
  `scheduled`; janela ⇒ `live`; após c/ gravação ⇒ `recording`; após s/ gravação ⇒ `ended`),
  `sanitizeDuration` (ausente/0/NaN ⇒ 90), `startsAt` inválido ⇒ `scheduled`, `isWatchable` e
  `watchResource` (stream no `live`, gravação no `recording`, `null` nos demais)
- [X] T005 Criar `lib/lives.ts` (framework-agnostic, pg-mem-safe): tipos `Live`/`LiveRow`/`LiveState`/
  `LiveInput`, `mapLive`, `SELECT`, `listLives`/`getLive`/`createLive` (valida `title` ⇒
  `LiveValidationError`), e as puras `DEFAULT_DURATION_MIN=90`, `sanitizeDuration`, `liveState(live,
  now)`, `isWatchable(state)`, `watchResource(live, state)` conforme `data-model.md` — até
  `tests/lives.state.test.ts` passar

**Checkpoint**: schema tem `lives`; taxonomia tem `live.opened`; regra de estado pura e testada.

---

## Phase 3: User Story 1 - Ver a agenda de lives e seu estado (Priority: P1) 🎯 MVP

**Goal**: o hub lista as lives com estado derivado do horário (scheduled/live/recording/ended), atrás do
gate; a lista **nunca** vaza url de embed.

**Independent Test**: seedar 3 lives (futuro / janela-agora / passado c/ gravação) e um lead com gate ⇒
`GET /api/evento/lives` devolve os estados corretos, `watchable` coerente e sem `streamUrl`/`recordingUrl`.

### Tests for User Story 1 (TDD — escrever FIRST) ⚠️

- [X] T006 [US1] Escrever teste (deve FALHAR) `tests/evento.lives.route.test.ts` (parte GET): lead com
  gate + 3 lives (futuro/janela/passado-c-gravação) ⇒ `GET` reflete `scheduled`/`live`/`recording`,
  `watchable` = gate × isWatchable, e a resposta **não** contém `streamUrl`/`recordingUrl`; visitante sem
  sessão ⇒ `watchable:false`; sem lives ⇒ `lives:[]`

### Implementation for User Story 1

- [X] T007 [US1] Criar `app/api/evento/lives/route.ts` (`GET`): resolver sessão→lead (reúso
  `verifySession`/`getLeadById`), `hasCompletedSurvey`, listar `lives`, mapear cada uma com `state =
  liveState(live, now)`, `watchable = authenticated && surveyAnswered && isWatchable(state)`,
  `hasRecording = !!recordingUrl`, **sem** expor url — até `T006` (GET) passar

**Checkpoint**: US1 funcional — agenda com estados visível e segura (sem vazar embed).

---

## Phase 4: User Story 2 - Assistir e ter o acesso medido (Priority: P2)

**Goal**: abrir uma live assistível (`live`/`recording`) revalida gate+estado no servidor, emite
`live.opened` e devolve o embed dentro da plataforma; abrir não-assistível é negado sem medir.

**Independent Test**: `POST .../abrir` em live `live`/`recording` ⇒ `200 {resource}` + 1 `live.opened`
(`{liveId, state}`); em `scheduled`/`ended` ⇒ `403 not_watchable` sem `live.opened`; sem gate ⇒ `403
gated`; sem sessão ⇒ `401`.

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T008 [US2] Adicionar a `tests/evento.lives.route.test.ts` (parte abrir, deve FALHAR): assistível
  ⇒ `200` com `resource` (stream no `live`, gravação no `recording`, `external:false`) e exatamente 1
  `live.opened` com `{liveId, state}` em `engagement_events`; `scheduled`/`ended` ⇒ `403 not_watchable`
  e **0** `live.opened`; gate não satisfeito ⇒ `403 gated`; sem sessão ⇒ `401`

### Implementation for User Story 2

- [X] T009 [US2] Criar `app/api/evento/lives/[id]/abrir/route.ts` (`POST`): 401 sem sessão → 404
  lead/live → 403 `gated` → 403 `not_watchable` (via `isWatchable(liveState(...))`, incluir `state`) →
  `emit(eventId, leadId, 'live.opened', { liveId, state })` → `{ state, resource: watchResource(live,
  state), external: false }`; `emit` **estritamente após** as validações — até `T008` passar

**Checkpoint**: US1+US2 verdes; engajamento com lives medido e desacoplado (score/streak consomem depois).

---

## Phase 5: User Story 3 - Provisionar/curar a agenda (Priority: P3)

**Goal**: cadastrar/ajustar lives por config/DB (`X-Api-Key`), sem admin UI; borda protegida.

**Independent Test**: `POST /api/events/[eventId]/lives` sem/`X-Api-Key` errada ⇒ 401; sem `title` ⇒
400; ok ⇒ 201 e a live aparece na agenda com o estado do horário.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T010 [US3] Escrever teste (deve FALHAR) `tests/lives.ingest.test.ts`: `POST
  /api/events/[eventId]/lives` ⇒ 401 sem/`X-Api-Key` errada; 404 evento inexistente; 400 sem `title`;
  201 cria a live (id `live_`) com `startsAt`/`durationMin`/urls opcionais persistidos

### Implementation for User Story 3

- [X] T011 [US3] Criar `app/api/events/[eventId]/lives/route.ts` (`POST`): validar eventId, `getEvent`,
  `verifyApiKey` (401), `createLive` (400 em `LiveValidationError`), `201 { id }` — espelha
  `app/api/events/[eventId]/conteudo/route.ts` — até `T010` passar

**Checkpoint**: as três stories independentemente verdes; agenda provisionável.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [US1] Criar `app/evento/lives/page.tsx` + `components/LivesAquecimento.tsx` (mobile-first,
  375–430px, alvos ≥44px): consome `GET /api/evento/lives`, mostra rótulo por estado (🕒 em breve com
  data / 🔴 ao vivo agora / ▶️ ver gravação / ⏹ encerrada) e CTA condicional que chama `.../abrir` e
  embeda o `resource` na plataforma; degrada com segurança quando `lives:[]`
- [X] T013 [P] Documentar `live.opened` em `CONTRIBUTING.md §3` (emite=8.17; payload `{liveId, state}`;
  consumidores futuros: lead score, streak) e a entidade `lives` (campos + estado derivado + duração
  default 90) junto à referência de dados
- [X] T014 Rodar o roteiro de `specs/epic-8/8.17-lives-aquecimento-mock/quickstart.md` ponta a ponta,
  confirmar `npm test` **verde** e `tsc --noEmit` limpo

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T005)** → **User Stories** → **Polish (T012–T014)**.
- **Foundational bloqueia tudo**: T002 (tabela), T003 (tipo) e T004 (teste) podem correr em paralelo;
  T005 (lib) depende de T004 (teste escrito) e é pré-requisito das rotas.
- **US1 (T006–T007)** é o MVP e não depende de US2/US3.
- **US2 (T008–T009)** depende de US1 (compartilha `lives` + o mesmo arquivo de teste de rota).
- **US3 (T010–T011)** é independente de US2 (arquivo de rota e de teste próprios); depende só da
  Foundational.
- **Polish** por último (T012 UI depende de US1/US2 prontas).

### Ordem de arquivos (mesma-file ⇒ sequencial)

- `tests/evento.lives.route.test.ts`: T006 (GET) → T008 (abrir) — mesmo arquivo.
- `lib/db.ts`: T002 (isolado). `lib/engagement.ts`: T003 (isolado). `lib/lives.ts`: T005 (isolado).
- Rotas em arquivos distintos (T007, T009, T011) ⇒ paralelizáveis entre si após a Foundational.

## Parallel Opportunities

- **T002 / T003 / T004 [P]** juntos (arquivos distintos) na Foundational.
- Após a Foundational: **US3 (T010–T011)** pode correr em paralelo a **US1/US2** (arquivos próprios).
- **T013 [P]** (docs) em paralelo com o restante do Polish.

## Independent Test Criteria

- **US1**: 3 lives ⇒ estados corretos por horário; lista sem vazar url.
- **US2**: abrir assistível ⇒ 200 + 1 `live.opened`; não-assistível/gated/sem-sessão ⇒ negado sem medir.
- **US3**: provisionar ⇒ 401/400/201 conforme; live entra na agenda.

## Implementation Strategy

- **MVP = US1** (T001–T007): agenda de lives com estados — o participante vê o que vem e quando.
- **Incremento 1 = US2** (assistir + medir `live.opened`) — o valor de "medir engajamento".
- **Incremento 2 = US3** (provisionar a agenda). UI (T012) fecha a experiência.
- Entregar em PR pequeno; `npm test` verde obrigatório (Const. V).
