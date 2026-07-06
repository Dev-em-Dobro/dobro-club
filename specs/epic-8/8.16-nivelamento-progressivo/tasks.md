---
description: "Task list for Story 8.16 — Nivelamento com liberação progressiva por lead (drip por tempo de entrada)"
---

# Tasks: Nivelamento com liberação progressiva por lead (drip por tempo de entrada)

**Input**: Design documents from `specs/epic-8/8.16-nivelamento-progressivo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/nivelamento-progressivo.md, quickstart.md

**Tests**: INCLUÍDOS — TDD não-negociável (Constituição V). Teste escrito **antes** e **falhando** antes
da implementação.

**Organization**: por user story (US1 liberação por-lead P1, US2 curadoria do ritmo P2, US3
mensurabilidade P3). A story **reúsa a 8.14** (modelo `content_items`, hub, `content.opened`, rota
admin); o net-new é o **modo de liberação por-lead** (offset em dias × data de entrada) que **prevalece
para aulas** e convive com o drip por calendário da 8.14.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3; Setup/Foundational/Polish sem label
- Caminhos reais em cada tarefa. App **Next.js App Router + TS** (`app/`, `lib/`, `tests/`).

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs reusadas
  (`lib/content.ts` com `listContentItems`/`getContentItem`/`createContentItem`/`isReleased`,
  `lib/leads.ts` com `getLeadById` e `Lead.createdAt`, `lib/engagement.ts` com `hasCompletedSurvey`/
  `emit`, `lib/auth/session.ts`) e das rotas `app/api/evento/conteudo/route.ts`,
  `app/api/evento/conteudo/[id]/abrir/route.ts`, `app/api/events/[eventId]/conteudo/route.ts` — pré-condição TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: coluna `release_offset_days` + regra de liberação por-lead em `lib/content.ts` — **todas**
as stories dependem disto.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 Adicionar coluna `release_offset_days int` à tabela `content_items` em `lib/db.ts` (no
  `CREATE TABLE content_items` do `SCHEMA` **e** `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS
  release_offset_days int` no bloco skippable/idempotente de `initSchema`) — pg-mem-safe (int, sem
  FK/GENERATED/DEFAULT no DDL)
- [X] T003 [P] Escrever teste (deve FALHAR) `tests/content.release-for-lead.test.ts`: `isLessonReleasedForLead`
  (offset 0/2, entrada passada/recente), `sanitizeOffset` (ausente/negativo/`NaN` ⇒ 0),
  `isItemReleasedForLead` (kind='lesson' ⇒ por-lead; kind='doc' ⇒ cai em `isReleased`),
  `releaseForLeadAt` (= `entrada + offset*dia` p/ lesson; `= releaseAt` p/ não-lesson), entrada
  inválida ⇒ tratada como "agora"
- [X] T004 Estender `lib/content.ts`: adicionar `releaseOffsetDays` a `ContentItem`/`ContentRow`/`mapContentItem`
  e ao `SELECT` (`release_offset_days AS "releaseOffsetDays"`); implementar `sanitizeOffset`,
  `isLessonReleasedForLead(item, leadEntryDate, now)`, `isItemReleasedForLead(item, leadEntryDate, now)`
  e `releaseForLeadAt(item, leadEntryDate)` conforme `data-model.md` — até `tests/content.release-for-lead.test.ts` passar

**Checkpoint**: a regra de liberação por-lead existe e é pura/testada; schema comporta o offset.

---

## Phase 3: User Story 1 - Aulas liberam no ritmo de cada participante (Priority: P1) 🎯 MVP

**Goal**: no hub, as aulas (`kind='lesson'`) liberam por `lead.createdAt + offset`; aula futura aparece
"em breve" com data por lead; abrir aula não liberada é negado no servidor. Docs/CodeQuest seguem o
calendário da 8.14.

**Independent Test**: dois leads (`createdAt` "hoje" e "há 5 dias"), gate satisfeito ⇒ `GET
/api/evento/conteudo` devolve `available` **diferente** para a mesma aula; `POST .../abrir` em aula não
liberada p/ o lead ⇒ `403 not_released` **sem** `content.opened`; em aula liberada ⇒ `200 {resource}` **com** `content.opened`.

### Tests for User Story 1 (TDD — escrever FIRST) ⚠️

- [X] T005 [US1] Escrever teste (deve FALHAR) `tests/evento.conteudo.progressivo.test.ts` (mock de
  `lib/engagement` `emit`, `hasCompletedSurvey=true`): dois leads com `createdAt` distintos ⇒ `GET`
  devolve `available` divergente para a mesma aula e `releaseForLeadAt` calculado por lead; aula futura
  p/ o lead ⇒ `available:false`; `POST .../abrir` em aula não liberada ⇒ `403 not_released` e `emit`
  **não** chamado; em aula liberada ⇒ `200` e `emit('content.opened')` chamado

### Implementation for User Story 1

- [X] T006 [US1] Estender `app/api/evento/conteudo/route.ts`: usar `isItemReleasedForLead(item,
  lead?.createdAt ?? null, now)` no cálculo de `available` (em vez de `isReleased`) e incluir
  `releaseOffsetDays` + `releaseForLeadAt(item, lead?.createdAt ?? null)` por item na resposta —
  visitante/sem sessão mantém `available:false`
- [X] T007 [US1] Estender `app/api/evento/conteudo/[id]/abrir/route.ts`: trocar a checagem
  `isReleased(item)` por `isItemReleasedForLead(item, lead.createdAt, now)`; no `403` de não liberado
  devolver `releaseForLeadAt` (lesson) / `releaseAt` (demais); manter `emit('content.opened')`
  **estritamente após** a revalidação — até `T005` passar

**Checkpoint**: US1 funcional — MVP entregável (aulas liberam por lead; sem regressão em docs/CodeQuest).

---

## Phase 4: User Story 2 - Curadoria define o ritmo por aula (Priority: P2)

**Goal**: setar o offset por aula via provisionamento (config/DB, `X-Api-Key`), sem admin UI; offset
ausente ⇒ default 0.

**Independent Test**: criar aula com `releaseOffsetDays:2` e outra sem o campo; a primeira libera em
`entrada+2d`, a segunda usa default 0; alterar o offset reflete na próxima leitura do hub.

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T008 [US2] Adicionar caso (deve FALHAR antes) a `tests/evento.conteudo.progressivo.test.ts` (ou
  arquivo de rota admin): `POST /api/events/[eventId]/conteudo` (`X-Api-Key`) com `releaseOffsetDays:2`
  persiste o offset e a aula reflete liberação em `entrada+2d`; sem o campo ⇒ persistido `null` e
  tratado como 0; valor negativo/não-inteiro ⇒ tratado como 0 (não rejeita criação)

### Implementation for User Story 2

- [X] T009 [US2] Estender `app/api/events/[eventId]/conteudo/route.ts` e `ContentInput`/`createContentItem`
  em `lib/content.ts`: aceitar e persistir `releaseOffsetDays?: number | null` (INSERT inclui a coluna);
  sem validação rígida (saneamento fica no cálculo) — até `T008` passar

**Checkpoint**: US1+US2 verdes; ritmo de aquecimento ajustável por aula sem código.

---

## Phase 5: User Story 3 - Acesso mensurável para aquecimento futuro (Priority: P3)

**Goal**: garantir que abrir aula liberada emite `content.opened` (reúso 8.14) e abrir aula não liberada
**não** emite — sinal pronto p/ score (8.17) e streak (8.18).

**Independent Test**: aula liberada ⇒ 1 `content.opened` com `{kind:'lesson', itemId}`; aula não
liberada ⇒ 0 eventos de abertura.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T010 [US3] Adicionar caso (deve FALHAR antes se houver vazamento) a
  `tests/evento.conteudo.progressivo.test.ts`: asserir o **payload** de `emit` em aula liberada
  (`type='content.opened'`, `kind='lesson'`, `itemId`) e **ausência** de qualquer `emit` quando `403
  not_released` ou `403 gated`

### Implementation for User Story 3

- [X] T011 [US3] Confirmar em `app/api/evento/conteudo/[id]/abrir/route.ts` que `emit('content.opened')`
  ocorre **somente** no caminho liberado (após gate + `isItemReleasedForLead`), sem novo tipo de evento
  na taxonomia FROZEN; ajustar apenas se `T010` acusar vazamento — sem regressão em US1/US2

**Checkpoint**: as três stories independentemente verdes; acesso mensurável e desacoplado dos consumidores.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Documentar o campo `content_items.release_offset_days` (semântica: dias após a entrada do
  lead; aplica-se a `kind='lesson'`; default 0; precedência sobre `release_at` para aulas) em comentário
  de `lib/content.ts` e/ou `CONTRIBUTING.md`, para o provisionamento não virar conhecimento tácito
- [X] T013 [P] QA visual mobile-first do hub `app/evento/conteudo/page.tsx` a 375–430px: aula "em breve"
  exibe a **data prevista por lead** (`releaseForLeadAt`), alvos ≥44px, sem layout shift (estrutural
  neste ambiente; render real quando possível)
- [X] T014 Rodar o roteiro de `specs/epic-8/8.16-nivelamento-progressivo/quickstart.md` ponta a ponta,
  confirmar `npm test` **verde** e `tsc --noEmit` limpo (sem regressão na 8.14: docs/CodeQuest por calendário)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → **User Stories** → **Polish (T012–T014)**.
- **Foundational bloqueia tudo**: T002 (coluna) antes de T004 (mapping/helpers); T003 (teste) em
  paralelo a T002.
- **US1 (T005–T007)** é o MVP e não depende de US2/US3.
- **US2 (T008–T009)** depende de US1 (compartilha `lib/content.ts` e o modo por-lead).
- **US3 (T010–T011)** depende de US1 (mesma rota `abrir` e mesmo arquivo de teste).
- **Polish** por último.

### Ordem de arquivos (mesma-file ⇒ sequencial)

- `lib/content.ts`: T004 → T009 (US2 estende `ContentInput`/`createContentItem`).
- `app/api/evento/conteudo/[id]/abrir/route.ts`: T007 → T011.
- `tests/evento.conteudo.progressivo.test.ts`: T005 → T008 → T010 (mesmo arquivo).
- `lib/db.ts`: T002 (isolado).

## Parallel Opportunities

- **T003 [P]** (novo arquivo de teste) em paralelo a **T002** (edita `lib/db.ts`).
- **T012 [P]** (docs) e **T013 [P]** (QA visual) em paralelo no Polish.
- Demais tarefas tocam `lib/content.ts`/rotas/o mesmo teste ⇒ **sequenciais**.

## Independent Test Criteria

- **US1**: dois leads em datas diferentes ⇒ `available` divergente; abrir não liberada ⇒ 403 sem `content.opened`.
- **US2**: offset por aula persistido (`X-Api-Key`); ausente ⇒ default 0; muda ⇒ reflete na leitura.
- **US3**: aula liberada ⇒ 1 `content.opened`; não liberada/gated ⇒ 0.

## Implementation Strategy

- **MVP = US1** (T001–T007): entrega o valor central — aulas liberam no ritmo de cada participante.
- **Incremento 1 = US2** (curadoria do offset) e **Incremento 2 = US3** (mensurabilidade), ambos finos
  sobre o comportamento já herdado da 8.14.
- Entregar em PR pequeno; `npm test` verde obrigatório (Const. V); sem regressão na 8.14.
