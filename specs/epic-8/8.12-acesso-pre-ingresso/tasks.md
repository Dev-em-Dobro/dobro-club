---
description: "Task list for Story 8.12 — Acesso pré-ingresso (credencial provisória + hub do evento)"
---

# Tasks: Acesso pré-ingresso (credencial provisória + hub do evento)

**Input**: Design documents from `specs/epic-8/8.12-acesso-pre-ingresso/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/evento-api.md, quickstart.md

**Tests**: INCLUÍDOS — TDD é não-negociável (Constituição V). Todo teste é escrito **antes** e deve
**falhar** antes da implementação (`npm test`).

**Organization**: tarefas agrupadas por user story (US1 P1, US2 P2, US3 P3), cada uma entregável e
testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3 (fases de story); Setup/Foundational/Polish sem label
- Caminhos de arquivo reais em cada tarefa

## Path Conventions

Aplicação **Next.js App Router + TypeScript**, single-origin (raiz do repo): `app/`, `lib/`,
`components/`, `tests/`. Camada de dados framework-agnostic em `lib/` (pg-mem-safe).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: garantir baseline antes do TDD.

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs base reusadas (`lib/db.ts`, `lib/leads.ts`, `lib/events.ts`, `lib/ingresso.ts`, `lib/ticket.ts`, `lib/engagement.ts`, `lib/auth/session.ts`) — pré-condição para TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: janela/`phase` e o campo de data que **todas** as stories de credencial dependem.

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase.

- [X] T002 Adicionar coluna `week_starts_at timestamptz` ao `SCHEMA` e ao bloco skippable de `initSchema` (via `ALTER TABLE events ADD COLUMN IF NOT EXISTS week_starts_at timestamptz`) em `lib/db.ts`
- [X] T003 [P] Expor `weekStartsAt` (ISO string | null) no tipo `EventRow` e no `mapEvent` de `lib/events.ts` (snake→camel na borda)
- [X] T004 [P] Escrever teste (deve FALHAR) `tests/ingresso.phase.test.ts`: `phase='provisoria'` (now < janela), `phase='oficial'` (now ≥ janela), borda exata em `windowOpensAt`, e `weekStartsAt=null` ⇒ `provisoria` + `windowOpensAt=null`
- [X] T005 Implementar funções puras `ingressoWindowOpensAt(event)` (`weekStartsAt − 3 dias` | null) e `ingressoPhase(event, now=new Date())` em `lib/ingresso.ts` até `tests/ingresso.phase.test.ts` passar

**Checkpoint**: janela e `phase` prontos e testados — stories podem começar.

---

## Phase 3: User Story 1 - Entrar antes do ingresso via credencial provisória (Priority: P1) 🎯 MVP

**Goal**: lead autenticado abre o hub e vê sua credencial provisória (ticket da 8.3 em estado
pré-evento) + contagem para a abertura da janela; acesso emite `hub.viewed`.

**Independent Test**: com evento cujo `weekStartsAt` está a >3 dias e um lead com `dc_session`,
`GET /api/evento` retorna `phase='provisoria'` + `ticket`; `app/evento` renderiza a credencial no
mobile; revisitar não duplica nada.

### Tests for User Story 1 (TDD — escrever FIRST, garantir que FALHAM) ⚠️

- [X] T006 [US1] Escrever teste (deve FALHAR) `tests/evento.route.test.ts`: 401 sem `dc_session`; `200` com `phase='provisoria'`, `ticket` (imageUrl/qrValue/shareUrl), `windowOpensAt` no futuro, `lead` sem `token`; emite `hub.viewed` com `{ phase }`; acessos repetidos não criam credencial (INV-2)

### Implementation for User Story 1

- [X] T007 [US1] Adicionar `'hub.viewed'` ao union `EngagementType` em `lib/engagement.ts` (taxonomia FROZEN — mudança coordenada; registrar em `CONTRIBUTING.md §3` na Polish)
- [X] T008 [US1] Implementar `GET app/api/evento/route.ts`: resolve o lead via `dc_session` (`verifySession`), monta `{ lead, phase: ingressoPhase(event), ticket: buildTicket(lead), windowOpensAt }`, emite `emit(eventId, leadId, 'hub.viewed', { phase })` best-effort; 401/404/500 conforme contrato (depende de T005, T007)
- [X] T009 [P] [US1] Criar `components/EventoHub.tsx`: casca mobile-first (375–430px, toque ≥44px) exibindo a credencial provisória (ticket + selo "provisória") e a contagem para `windowOpensAt`
- [X] T010 [P] [US1] Criar `app/evento/page.tsx`: `AuthProvider` + `EventoHub` (padrão do `app/meu-acesso`), consumindo `GET /api/evento`

**Checkpoint**: US1 funcional e testável — MVP entregável (acesso + credencial + hub).

---

## Phase 4: User Story 2 - Credencial converge para o ingresso oficial (Priority: P2)

**Goal**: quando a janela abre (T-3 dias), o mesmo lead/ticket passa a `phase='oficial'` sem migração
nem novo cadastro; quem entra já dentro da janela recebe `oficial` direto.

**Independent Test**: com `weekStartsAt` a ≤3 dias (ou `now` além de `windowOpensAt`),
`GET /api/evento` retorna `phase='oficial'` e o hub mostra o ingresso oficial no lugar da credencial.

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T011 [US2] Adicionar casos a `tests/evento.route.test.ts` (deve FALHAR antes): `phase='oficial'` quando `now ≥ windowOpensAt`; lead **novo** criado já dentro da janela ⇒ `oficial` direto; atribuição de indicação (`referrerLeadId`) preservada na virada

### Implementation for User Story 2

- [X] T012 [US2] Estender `components/EventoHub.tsx` para tratar `phase='oficial'`: apresentar o ingresso oficial (sem selo provisório) reusando o mesmo `ticket`, confirmando que nada além da apresentação muda na convergência

**Checkpoint**: US1 e US2 funcionam de forma independente; convergência é só mudança de `phase`.

---

## Phase 5: User Story 3 - Hub respeita o gate da pesquisa (Priority: P3)

**Goal**: conteúdo do hub bloqueado até o lead responder a pesquisa (8.2); `surveyAnswered` derivado
de `engagement_events(survey.completed)`.

**Independent Test**: lead sem `survey.completed` ⇒ `surveyAnswered=false` e conteúdo bloqueado;
após emitir `survey.completed`, `GET /api/evento` retorna `surveyAnswered=true` e o bloqueio some.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T013 [P] [US3] Escrever teste (deve FALHAR) `tests/survey-gate.test.ts`: `hasCompletedSurvey(leadId)` retorna `true` só quando existe `engagement_events` com `type='survey.completed'` para o lead
- [X] T014 [US3] Adicionar caso a `tests/evento.route.test.ts` (deve FALHAR antes): `surveyAnswered` reflete a existência de `survey.completed` para o lead da sessão

### Implementation for User Story 3

- [X] T015 [P] [US3] Implementar `hasCompletedSurvey(leadId)` em `lib/engagement.ts` (SELECT 1 em `engagement_events` por `lead_id` + `type='survey.completed'`) até `tests/survey-gate.test.ts` passar
- [X] T016 [US3] Estender `GET app/api/evento/route.ts` para incluir `surveyAnswered: await hasCompletedSurvey(lead.id)` no payload (depende de T015)
- [X] T017 [US3] Estender `components/EventoHub.tsx`: bloquear o conteúdo quando `surveyAnswered=false` e oferecer caminho claro para a pesquisa; liberar quando `true`

**Checkpoint**: as três stories independentemente funcionais.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 [P] Registrar `hub.viewed` (emite=8.12) na tabela FROZEN de `CONTRIBUTING.md §3`, coerente com o precedente `referral.signup`
- [X] T019 [P] Validação mobile-first do hub a 375–430px (toque ≥44px, sem layout shift, safe-areas) em `app/evento/page.tsx` / `components/EventoHub.tsx`
- [X] T020 Rodar o roteiro de `specs/epic-8/8.12-acesso-pre-ingresso/quickstart.md` ponta a ponta e confirmar `npm test` verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia** todas as user stories (T002→T003/T004→T005).
- **US1 (Phase 3)**: depende do Foundational. **MVP.**
- **US2 (Phase 4)**: depende do Foundational; reusa a rota da US1 (`phase` já vem de `ingressoPhase`).
- **US3 (Phase 5)**: depende do Foundational; **estende a rota e o componente criados na US1**
  (T016 depende de T008; T017 depende de T009).
- **Polish (Phase 6)**: depende das stories desejadas concluídas.

### User Story Dependencies

- **US1 (P1)**: independente após Foundational.
- **US2 (P2)**: independente após Foundational (só apresentação do `phase='oficial'`).
- **US3 (P3)**: funcionalmente independente, mas **toca os mesmos arquivos** da US1 (`app/api/evento/route.ts`, `components/EventoHub.tsx`) — sequenciar após US1 para evitar conflito.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (TDD).
- Funções puras/leitura antes da rota; rota antes da UI.
- Story completa antes de passar para a próxima prioridade.

### Parallel Opportunities

- **Foundational**: T003 e T004 em paralelo (arquivos diferentes: `lib/events.ts` × `tests/`).
- **US1**: T009 e T010 em paralelo (componente × página) após a rota (T008).
- **US3**: T013 (teste) em paralelo com nada de US1/US2 pendente; T015 é `[P]` por ser arquivo de lib isolado.
- **Polish**: T018 e T019 em paralelo.
- ⚠️ Não paralelizar tarefas que editam o mesmo arquivo (`route.ts` em T008/T016; `EventoHub.tsx` em T009/T012/T017).

---

## Parallel Example: Foundational

```bash
# Após T002 (schema), rodar juntas:
Task: "T003 expor weekStartsAt em lib/events.ts"
Task: "T004 escrever tests/ingresso.phase.test.ts (deve falhar)"
```

## Parallel Example: User Story 1

```bash
# Após T008 (rota), rodar juntas:
Task: "T009 criar components/EventoHub.tsx"
Task: "T010 criar app/evento/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → 2. Phase 2 (Foundational, CRÍTICA) → 3. Phase 3 (US1).
4. **PARAR e VALIDAR**: testar US1 isolada (acesso + credencial provisória + hub + `hub.viewed`).
5. Demonstrar (MVP pronto).

### Incremental Delivery

- Setup + Foundational → base pronta.
- + US1 → credencial provisória e hub (MVP).
- + US2 → convergência para o ingresso oficial na virada.
- + US3 → gate da pesquisa no hub.
- Polish → contrato §3, QA mobile, quickstart.

---

## Notes

- Nenhuma dependência externa nova; reúso total do ticket derivado da 8.3 (`buildTicket`).
- Nenhuma tabela nova — só 1 coluna (`week_starts_at`) e derivações em TS (pg-mem-safe).
- `hub.viewed` exige atualização coordenada da taxonomia FROZEN (CONTRIBUTING §3).
- Verificar que cada teste falha antes de implementar; commitar por tarefa ou grupo lógico.
