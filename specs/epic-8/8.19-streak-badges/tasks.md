---
description: "Task list for Story 8.19 — Streak e badges de engajamento (gamificação)"
---

# Tasks: Streak e badges de engajamento (gamificação)

**Input**: Design documents from `specs/epic-8/8.19-streak-badges/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/streak-badges.md, quickstart.md

**Tests**: INCLUÍDOS — TDD não-negociável (Constituição V). Teste escrito **antes** e **falhando** antes
da implementação.

**Organization**: por user story (US1 streak+painel P1, US2 badges P2, US3 consumo admin P3). Story de
**consumo + exibição**: streak/badges derivados de `engagement_events` + lead score (8.18); **sem tabela,
sem emissão, sem tipo novo**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3; Setup/Foundational/Polish sem label
- Caminhos reais em cada tarefa. App **Next.js App Router + TS** (`app/`, `lib/`, `tests/`).

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs reusadas
  (`lib/engagement.ts` com `emit`, `lib/score.ts` com `getLeadScore`, `lib/leads.ts` com `getLeadById`,
  `lib/events.ts` com `getEvent`/`verifyApiKey`, `lib/auth/session.ts` com `verifySession`/`COOKIE`) —
  pré-condição TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a lib de gamificação (dia/streak/badges puros) — **todas** as stories dependem dela.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 [P] Escrever teste (deve FALHAR) `tests/gamification.streak.test.ts`: `dayKey` agrupa por dia
  no fuso UTC−3 (23h/00h05 ⇒ dias distintos); `computeStreak` — 3 dias consecutivos terminando hoje ⇒
  `current:3`; gap de 1 dia zera; vários eventos no mesmo dia ⇒ 1; tolerância (último ativo = ontem e
  hoje vazio ⇒ mantém); `longest` = maior sequência histórica
- [X] T003 [P] Escrever teste (deve FALHAR) `tests/gamification.badges.test.ts`: `evaluateBadges` —
  `primeira-live` (`live.opened>=1`), `explorador` (`content.opened>=5`), `streak-3`/`streak-7`
  (`longest`), `engajado` (`score>=20`); conquistado × bloqueado; determinístico; badge com `test` que
  lança ⇒ `earned:false` sem derrubar os demais
- [X] T004 Criar `lib/gamification.ts` (framework-agnostic): `DAY_TZ_OFFSET_MIN=-180`, `ACTIVE_TYPES`,
  tipos (`Streak`/`BadgeDef`/`BadgeCtx`/`Badge`/`LeadGamification`), `dayKey`, `computeStreak`, catálogo
  `BADGES` (research D4) e `evaluateBadges` (avaliação isolada por badge) — até T002 **e** T003 passarem

**Checkpoint**: regras puras de streak e badges testadas; base para a leitura e rotas.

---

## Phase 3: User Story 1 - Ver meu streak no hub (Priority: P1) 🎯 MVP

**Goal**: o participante vê o próprio streak (current+longest) no hub via sessão; lead sem eventos ⇒ 0.

**Independent Test**: lead autenticado com atividade em dias consecutivos ⇒ `GET /api/evento/gamificacao`
devolve o streak correto; sem sessão ⇒ 401; painel mostra o streak.

### Tests for User Story 1 (TDD — escrever FIRST) ⚠️

- [X] T005 [US1] Escrever teste (deve FALHAR) `tests/gamification.route.test.ts` (parte participante,
  pg-mem + `emit`): `GET /api/evento/gamificacao` ⇒ `401` sem sessão; `200 { streak, badges }` do próprio
  lead com streak coerente aos dias ativos; lead sem eventos ⇒ `streak {current:0,longest:0}`

### Implementation for User Story 1

- [X] T006 [US1] Adicionar `getLeadGamification(eventId, leadId, now)` a `lib/gamification.ts`: `query`
  `SELECT type, created_at FROM engagement_events WHERE event_id=$1 AND lead_id=$2`; derivar `counts` +
  `dayKeys` (tipos em `ACTIVE_TYPES`); `computeStreak`; `score` via `getLeadScore`; `evaluateBadges` ⇒
  `{ streak, badges }` — até a parte de streak de T005 passar
- [X] T007 [US1] Criar `app/api/evento/gamificacao/route.ts` (`GET`): `verifySession` → `getLeadById`
  (401 sem sessão) → `getLeadGamification(lead.eventId, lead.id)` ⇒ `200` — espelha
  `app/api/evento/conteudo/route.ts` — até T005 passar
- [X] T008 [US1] Criar `app/evento/gamificacao/page.tsx` + `components/GamificacaoPainel.tsx`
  (mobile-first, 375–430px, ≥44px, sem shift): consome `GET /api/evento/gamificacao`, exibe o **streak**
  em destaque (current + "maior: longest") e um convite quando 0; degrada com segurança

**Checkpoint**: US1 funcional — MVP: streak visível e motivador no hub.

---

## Phase 4: User Story 2 - Conquistar e ver badges (Priority: P2)

**Goal**: o painel mostra badges conquistados e bloqueados (com critério); reflete eventos/score/streak.

**Independent Test**: lead que cruzou critérios ⇒ badges earned; demais bloqueados com critério; badge de
score reflete o lead score (8.18).

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T009 [US2] Adicionar a `tests/gamification.route.test.ts` (parte badges, deve FALHAR): lead com
  `live.opened` ⇒ `primeira-live` earned; lead com `content.opened`×5 ⇒ `explorador` earned; lead com
  score≥20 ⇒ `engajado` earned; badges não cruzados ⇒ `earned:false` com `criterion` presente

### Implementation for User Story 2

- [X] T010 [US2] Confirmar em `components/GamificacaoPainel.tsx` a **grade de badges** (conquistado vs.
  bloqueado com `criterion` visível) a partir de `data.badges`; ajustar `getLeadGamification`/`BADGES`
  apenas se T009 acusar lacuna — sem regressão em US1

**Checkpoint**: US1+US2 verdes; jornada de conquistas visível ao participante.

---

## Phase 5: User Story 3 - Consumo admin de streak+badges (Priority: P3)

**Goal**: o time/automação consulta streak+badges de um lead por `X-Api-Key`.

**Independent Test**: `GET /api/events/[eventId]/leads/[leadId]/gamification` ⇒ 401 sem/errada chave; 404
evento inexistente; 200 com `{ streak, badges }`.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T011 [US3] Adicionar a `tests/gamification.route.test.ts` (parte admin, deve FALHAR): `GET
  /api/events/[eventId]/leads/[leadId]/gamification` ⇒ `401` sem/`X-Api-Key` errada; `404` evento
  inexistente; `200 { streak, badges }` coerente

### Implementation for User Story 3

- [X] T012 [US3] Criar `app/api/events/[eventId]/leads/[leadId]/gamification/route.ts` (`GET`): validar
  eventId, `getEvent` (404), `verifyApiKey` (401), `getLeadGamification` ⇒ `200` — espelha o padrão admin
  (`.../leads/[leadId]/score`) — até T011 passar

**Checkpoint**: as três stories independentemente verdes; sinal consumível pelo time.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Documentar streak/badges em `CONTRIBUTING.md §3` (consumidor 8.19: dia ativo =
  content.opened/live.opened; catálogo de badges e fuso versionados em `lib/gamification.ts`; derivado,
  não persistido; participante por `dc_session`, consumo por `X-Api-Key`)
- [X] T014 [P] QA visual mobile-first de `app/evento/gamificacao` a 375–430px (streak em destaque, grade
  de badges, alvos ≥44px, sem layout shift) — estrutural neste ambiente
- [X] T015 Rodar o roteiro de `specs/epic-8/8.19-streak-badges/quickstart.md` ponta a ponta, confirmar
  `npm test` **verde** e `tsc --noEmit` limpo (sem tabela nova, sem novo tipo de evento)

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → **User Stories** → **Polish (T013–T015)**.
- **Foundational bloqueia tudo**: T002 e T003 (testes puros, [P]) antes de T004 (lib); a lib é
  pré-requisito da leitura e das rotas.
- **US1 (T005–T008)** é o MVP; não depende de US2/US3.
- **US2 (T009–T010)** depende de US1 (mesma lib/painel/arquivo de teste de rota).
- **US3 (T011–T012)** depende da Foundational (rota admin própria); independente de US1/US2.
- **Polish** por último.

### Ordem de arquivos (mesma-file ⇒ sequencial)

- `lib/gamification.ts`: T004 → T006 (→ US2/US3 reúsam sem novas edições, salvo lacuna).
- `tests/gamification.route.test.ts`: T005 → T009 → T011 (mesmo arquivo).
- `components/GamificacaoPainel.tsx`: T008 → T010 (mesmo arquivo).
- Rotas em arquivos distintos (T007, T012) ⇒ paralelizáveis entre si após suas libs.

## Parallel Opportunities

- **T002 / T003 [P]** juntos (testes puros, arquivos distintos) na Foundational.
- **US3 (T011–T012)** pode correr em paralelo a US1/US2 (rota e assert próprios) após a Foundational.
- **T013 / T014 [P]** no Polish.

## Independent Test Criteria

- **US1**: streak current/longest coerente; vários eventos/dia ⇒ 1; sem sessão ⇒ 401; lead sem eventos ⇒ 0.
- **US2**: badges earned quando o critério é cruzado; bloqueados expõem o critério; badge por score reflete 8.18.
- **US3**: consumo admin protegido (401/404/200) com o mesmo corpo.

## Implementation Strategy

- **MVP = US1** (T001–T008): streak visível no hub — o gancho de retorno.
- **Incremento 1 = US2** (badges) e **Incremento 2 = US3** (consumo admin), ambos finos sobre a mesma lib.
- Entregar em PR pequeno; `npm test` verde obrigatório (Const. V); sem tabela/tipo novo.
