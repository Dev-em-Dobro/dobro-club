---
description: "Task list for Story 8.15 — Onboarding via ActiveCampaign (lead da captação entra logado)"
---

# Tasks: Onboarding via ActiveCampaign (lead da captação entra logado)

**Input**: Design documents from `specs/epic-8/8.15-onboarding-activecampaign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/onboarding-ac.md, quickstart.md

**Tests**: INCLUÍDOS — TDD não-negociável (Constituição V). Teste escrito **antes** e **falhando** antes
da implementação.

**Organization**: por user story (US1 entrada P1, US2 idempotência P2, US3 provisionamento P3). A story
é **fina e reúsa a 8.1** (ingestão + magic link + webhook + entrada já em Next); o único net-new de
código é o **canal de onboarding por evento** para evitar e-mail duplicado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3; Setup/Foundational/Polish sem label
- Caminhos reais em cada tarefa. App **Next.js App Router + TS** (`app/`, `lib/`, `tests/`).

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs reusadas
  (`lib/db.ts`, `lib/events.ts` com `getEvent`/`verifyApiKey`, `lib/leads.ts` com `createOrGetLead`,
  `lib/validate.ts` com `validateLeadInput`, `lib/auth/token.ts` com `buildMagicLink`, `lib/email.ts`
  com `sendMagicLinkEmail`, `lib/webhook.ts` com `fireInscriptionWebhook`) — pré-condição TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: canal de onboarding no evento — **todas** as stories dependem dele.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 Adicionar coluna `onboarding_channel text` à tabela `events` em `lib/db.ts` (no `CREATE
  TABLE events` do `SCHEMA` **e** um `ALTER TABLE events ADD COLUMN IF NOT EXISTS onboarding_channel
  text` no bloco skippable/idempotente de `initSchema`) — pg-mem-safe (text, sem FK/GENERATED/índice)
- [X] T003 [P] Escrever teste (deve FALHAR) `tests/events.onboarding-channel.test.ts`: `getEvent`
  devolve `onboardingChannel`; `platformSendsOnboardingEmail(event)` ⇒ **false** quando
  `onboardingChannel='active-campaign'`, **true** quando `'platform'`/ausente/valor desconhecido
- [X] T004 Estender `lib/events.ts`: adicionar `onboardingChannel` ao `EventRow` e ao `SELECT_EVENT`
  (`onboarding_channel AS "onboardingChannel"`); exportar helper `platformSendsOnboardingEmail(event)`
  = `(event.onboardingChannel ?? 'platform') !== 'active-campaign'` — até `tests/events.onboarding-channel.test.ts`
  passar

**Checkpoint**: evento sabe seu canal de onboarding; regra derivada em TS.

---

## Phase 3: User Story 1 - Lead da captação entra logado e cai no aquecimento (Priority: P1) 🎯 MVP

**Goal**: quando a AC chama a ingestão (contato qualificado), o lead é criado, o webhook `lead.created`
sai com o `magicLink`, e — no canal `active-campaign` — a plataforma **não** envia e-mail (a AC envia). No canal
`platform` (default), o e-mail nativo é preservado.

**Independent Test**: `POST /api/events/[eventId]/leads` (X-Api-Key ok, contato novo) com evento
`onboarding_channel='active-campaign'` ⇒ `200 { isNew:true, magicLink }`, **sem** `sendMagicLinkEmail`, **com**
`fireInscriptionWebhook` contendo o `magicLink`; com canal `platform` ⇒ `sendMagicLinkEmail` é chamado.

### Tests for User Story 1 (TDD — escrever FIRST) ⚠️

- [X] T005 [US1] Escrever teste (deve FALHAR) `tests/onboarding.activecampaign.route.test.ts`
  (mockar `lib/email` e `lib/webhook`): canal `active-campaign` + contato novo ⇒ `200 { isNew:true, magicLink }`,
  **NÃO** chama `sendMagicLinkEmail`, **chama** `fireInscriptionWebhook` com o `magicLink`; canal
  `platform`/ausente + contato novo ⇒ **chama** `sendMagicLinkEmail`; webhook dispara nos dois casos

### Implementation for User Story 1

- [X] T006 [US1] Estender `app/api/events/[eventId]/leads/route.ts`: envolver o `sendMagicLinkEmail`
  em `if (platformSendsOnboardingEmail(event))`; manter `fireInscriptionWebhook(event, lead, magicLink)`
  disparando em `isNew` (inalterado). Nenhuma outra mudança de comportamento — até `T005` passar

**Checkpoint**: US1 funcional — MVP entregável (lead da AC entra logado, sem e-mail duplicado).

---

## Phase 4: User Story 2 - Reingestão idempotente (Priority: P2)

**Goal**: reenvio/atualização do mesmo contato pela AC não cria 2º lead nem 2º link, e não refira
efeitos.

**Independent Test**: 2ª chamada com mesmo email/telefone ⇒ `isNew:false`, **mesmo** `magicLink`,
**nenhum** webhook/e-mail disparado.

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T007 [US2] Adicionar caso (deve FALHAR antes) a `tests/onboarding.activecampaign.route.test.ts`:
  2ª chamada com mesmo email (e variação por telefone) ⇒ `isNew:false`, **mesmo** `magicLink` da 1ª;
  `sendMagicLinkEmail` e `fireInscriptionWebhook` **não** são chamados na 2ª

### Implementation for User Story 2

- [X] T008 [US2] Confirmar em `app/api/events/[eventId]/leads/route.ts` que os efeitos (e-mail +
  webhook) estão **estritamente** sob `if (isNew)` (comportamento herdado da 8.1); ajustar somente se
  `T007` acusar vazamento — sem regressão em US1

**Checkpoint**: US1 e US2 independentemente verdes; base de leads íntegra sob re-sync da AC.

---

## Phase 5: User Story 3 - Provisionar e verificar a integração por evento (Priority: P3)

**Goal**: ligar a AC ao evento (X-Api-Key + `webhook_url` da AC + `onboarding_channel='active-campaign'`), sem admin
UI; borda protegida por `X-Api-Key`; email canônico presente no payload.

**Independent Test**: chamada sem/`X-Api-Key` inválida ⇒ `401`, nenhum lead; contato com email ⇒ email
presente no lead e no payload do webhook.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T009 [US3] Adicionar caso (deve FALHAR antes) a `tests/onboarding.activecampaign.route.test.ts`:
  `401` sem/`X-Api-Key` inválida (nenhum lead criado; nenhum efeito); contato com email ⇒ `email`
  presente no lead e no payload passado a `fireInscriptionWebhook`

### Implementation for User Story 3

- [X] T010 [US3] Provisionamento (config/DB, sem admin UI): borda `401` coberta por `verifyApiKey`
  existente (testes T009, sem código novo de auth); provisionamento de produção via SQL/config
  documentado no `quickstart.md`. **Decisão de implementação**: NÃO forçar o evento demo compartilhado
  para `onboarding_channel='active-campaign'` — evitaria e-mail nativo no dev e geraria ruído de webhook para uma
  URL fake; o canal `active-campaign` já é exercitado pelos testes automatizados (pg-mem)

**Checkpoint**: as três stories independentemente funcionais; integração provisionável por evento.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 [P] Documentar o campo `events.onboarding_channel` (valores `platform`|`active-campaign`, default e
  efeito no e-mail) junto à referência de eventos (comentário em `lib/events.ts`/`CONTRIBUTING.md`),
  para o provisionamento não virar conhecimento tácito
- [X] T012 Rodar o roteiro de `specs/epic-8/8.15-onboarding-activecampaign/quickstart.md` ponta a ponta,
  confirmar `npm test` **verde** e `tsc --noEmit` limpo

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T004)** → **User Stories** → **Polish (T011–T012)**.
- **Foundational bloqueia tudo**: T002 (coluna) antes de T004 (mapping/helper); T003 (teste) pode ser
  escrito em paralelo a T002.
- **US1 (T005–T006)** é o MVP e não depende de US2/US3.
- **US2 (T007–T008)** e **US3 (T009–T010)** dependem de US1 (compartilham o mesmo route handler e
  arquivo de teste), então rodam **após** US1 e **em sequência entre si** (mesmo arquivo de teste).
- **Polish** por último.

### Ordem de arquivos (mesma-file ⇒ sequencial)

- `app/api/events/[eventId]/leads/route.ts`: T006 → T008 (US3 não mexe no route).
- `tests/onboarding.activecampaign.route.test.ts`: T005 → T007 → T009 (mesmo arquivo).
- `lib/db.ts`: T002 → T010.

## Parallel Opportunities

- **T003 [P]** (novo arquivo de teste) em paralelo a **T002** (edita `lib/db.ts`).
- **T011 [P]** (docs) em paralelo com o restante do Polish.
- Demais tarefas tocam `route.ts`/o mesmo teste ⇒ **sequenciais**.

## Independent Test Criteria

- **US1**: canal `active-campaign` ⇒ sem e-mail + webhook com `magicLink`; canal `platform` ⇒ com e-mail.
- **US2**: 2ª ingestão ⇒ `isNew:false`, mesmo link, nenhum efeito refeito.
- **US3**: `401` sem X-Api-Key; email canônico no payload.

## Implementation Strategy

- **MVP = US1** (T001–T006): entrega o valor central — lead da AC entra logado sem e-mail duplicado.
- **Incremento 1 = US2** (idempotência) e **Incremento 2 = US3** (provisionamento + borda), ambos
  majoritariamente testes sobre o comportamento já herdado da 8.1.
- Entregar em PR pequeno; `npm test` verde obrigatório (Const. V).
