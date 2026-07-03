---
description: "Task list for Story 8.14 — Conteúdos dia-1 (nivelamento + docs + acesso ao CodeQuest)"
---

# Tasks: Conteúdos dia-1 (nivelamento + docs + acesso ao CodeQuest)

**Input**: Design documents from `specs/epic-8/8.14-conteudos-dia-1/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/conteudo-api.md, quickstart.md

**Tests**: INCLUÍDOS — TDD não-negociável (Constituição V). Teste escrito **antes** e **falhando** antes
da implementação.

**Organization**: por user story (US1 aulas P1, US2 docs P2, US3 CodeQuest P3). Os 3 tipos compartilham
os mesmos endpoints (`kind`); a US1 entrega o vertical completo, US2/US3 estendem comportamento + UI.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2/US3; Setup/Foundational/Polish sem label
- Caminhos reais em cada tarefa. App **Next.js App Router + TS** (`app/`, `lib/`, `components/`, `tests/`).

---

## Phase 1: Setup

- [X] T001 Rodar `npm test` na raiz e confirmar suíte **verde** + presença das libs reusadas (`lib/db.ts`, `lib/events.ts`, `lib/leads.ts`, `lib/engagement.ts` com `hasCompletedSurvey`, `lib/auth/session.ts`) — pré-condição TDD

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modelo de conteúdo, drip, taxonomia e provisionamento — **todas** as stories dependem.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T002 Criar tabela `content_items` no `SCHEMA` de `lib/db.ts` (id texto, sem FK) + índices `idx_content_event` e `idx_content_event_kind` no bloco skippable de `initSchema`
- [X] T003 [P] Escrever teste (deve FALHAR) `tests/content.release.test.ts`: `isReleased` — `releaseAt=null` ⇒ liberado; data futura ⇒ bloqueado; borda exata em `releaseAt`
- [X] T004 Criar `lib/content.ts`: tipos `ContentKind`/`ContentItem`, `mapContentItem` (snake↔camel), `isReleased(item, now)`, `listContentItems(eventId)`, `getContentItem(eventId, id)`, `createContentItem(eventId, input)` (valida `kind`/`title`) — até `tests/content.release.test.ts` passar
- [X] T005 [P] Adicionar `'content.opened'` ao union `EngagementType` em `lib/engagement.ts` (taxonomia FROZEN — registrar em `CONTRIBUTING.md §3` na Polish)
- [X] T006 [P] Escrever teste (deve FALHAR) `tests/conteudo.ingest.test.ts`: `POST /api/events/[eventId]/conteudo` — 401 sem `X-Api-Key`; 400 payload inválido (`kind`/`title`); 201 cria item
- [X] T007 Implementar `app/api/events/[eventId]/conteudo/route.ts` (`POST`, `X-Api-Key` via `verifyApiKey`) usando `createContentItem` — até `tests/conteudo.ingest.test.ts` passar

**Checkpoint**: dados + drip + provisionamento prontos.

---

## Phase 3: User Story 1 - Aulas de nivelamento (Priority: P1) 🎯 MVP

**Goal**: lead que passou o gate lista e abre aulas de nivelamento (vídeo embedado) no hub; acessos
medidos; itens com data futura aparecem "em breve".

**Independent Test**: com um lead `survey.completed` e uma aula liberada, `GET /api/evento/conteudo`
retorna a aula `available:true` sem `resource`; `POST .../abrir` devolve o embed e emite
`content.opened`; aula com data futura ⇒ `403 not_released`.

### Tests for User Story 1 (TDD — escrever FIRST) ⚠️

- [X] T008 [US1] Escrever teste (deve FALHAR) `tests/conteudo.route.test.ts`: `GET /api/evento/conteudo` — 401 sem sessão; lista ordenada; `available = gate × release`; **`resource` nunca no payload** (INV-1/INV-2); `surveyAnswered=false` ⇒ tudo `available:false`
- [X] T009 [US1] Escrever teste (deve FALHAR) `tests/conteudo.abrir.test.ts`: `POST .../conteudo/[id]/abrir` — 401 sem sessão; 403 `gated` (sem pesquisa); 403 `not_released` (data futura); 200 devolve `resource` e **emite `content.opened { kind, itemId }`**; 404 item inexistente

### Implementation for User Story 1

- [X] T010 [US1] Implementar `GET app/api/evento/conteudo/route.ts`: resolve lead (`dc_session`), `surveyAnswered = hasCompletedSurvey`, lista via `listContentItems`, calcula `available` e **omite `resource`** dos não acessíveis (depende de T004)
- [X] T011 [US1] Implementar `POST app/api/evento/conteudo/[id]/abrir/route.ts`: revalida gate+`isReleased` no servidor (403 `gated`/`not_released`), emite `emit(..., 'content.opened', { kind, itemId })`, devolve `{ kind, resource }` (depende de T004, T005, T010)
- [X] T012 [P] [US1] Criar `components/ConteudoDia1.tsx`: seção de **aulas** (embed do vídeo ao abrir) + estados `locked`/"em breve" (com data), mobile-first (≥44px, sem layout shift)
- [X] T013 [P] [US1] Criar `app/evento/conteudo/page.tsx`: `AuthProvider` + `ConteudoDia1` consumindo `GET /api/evento/conteudo`
- [X] T014 [US1] Estender `components/EventoHub.tsx` (8.12): CTA "Ir para o conteúdo" apontando para `/evento/conteudo`

**Checkpoint**: US1 funcional — MVP entregável (aulas de nivelamento no hub).

---

## Phase 4: User Story 2 - Docs / materiais (incl. presentes) (Priority: P2)

**Goal**: lead que passou o gate vê e abre docs/materiais, incluindo docs marcados como presente.

**Independent Test**: com um `doc` `isGift:true` liberado, o lead vê o doc (com selo presente) e o
`abrir` devolve o recurso e mede; sem gate, o doc some do acesso e o `resource` nunca vaza.

### Tests for User Story 2 (TDD — escrever FIRST) ⚠️

- [X] T015 [US2] Adicionar casos a `tests/conteudo.route.test.ts`/`tests/conteudo.abrir.test.ts` (falhar antes): `kind=doc` com `isGift:true` é listado com o flag; `resource` do doc oculto sem gate; `abrir` de doc acessível devolve `resource` e emite `content.opened { kind:"doc" }`

### Implementation for User Story 2

- [X] T016 [US2] Estender `components/ConteudoDia1.tsx`: seção de **docs** (lista + selo "presente" quando `isGift`) e ação de abrir o doc via `POST .../abrir`

**Checkpoint**: US1 e US2 funcionais de forma independente.

---

## Phase 5: User Story 3 - Acesso ao CodeQuest (Priority: P3)

**Goal**: lead que passou o gate vê o cartão do CodeQuest; ao acionar, abre o CodeQuest **em nova aba**
(link externo) e o acesso é medido.

**Independent Test**: com `kind=codequest` liberado, `abrir` devolve `{ external:true, resource }` e
emite `content.opened { kind:"codequest" }`; o front abre em nova aba.

### Tests for User Story 3 (TDD — escrever FIRST) ⚠️

- [X] T017 [US3] Adicionar caso a `tests/conteudo.abrir.test.ts` (falhar antes): `abrir` de `kind=codequest` acessível devolve `external:true` além de `resource`; emite `content.opened { kind:"codequest" }`

### Implementation for User Story 3

- [X] T018 [US3] Estender `POST app/api/evento/conteudo/[id]/abrir/route.ts`: incluir `external: true` no payload quando `kind='codequest'` (depende de T011)
- [X] T019 [US3] Estender `components/ConteudoDia1.tsx`: cartão **CodeQuest** que, ao abrir, navega para o `resource` em **nova aba** (`target="_blank"` + `rel="noopener"`)

**Checkpoint**: as três stories independentemente funcionais.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Registrar `content.opened` (emite=8.14) na tabela FROZEN de `CONTRIBUTING.md §3`
- [X] T021 [P] Validação mobile-first de `app/evento/conteudo/page.tsx` / `components/ConteudoDia1.tsx` a 375–430px (toque ≥44px, sem layout shift; "em breve" e selo presente legíveis)
- [X] T022 Rodar o roteiro de `specs/epic-8/8.14-conteudos-dia-1/quickstart.md` ponta a ponta e confirmar `npm test` verde

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup; **bloqueia** todas as stories (T002→T003/T004; T005; T006→T007).
- **US1 (Phase 3)**: depende do Foundational. Cria os endpoints de lead (`GET`/`abrir`). **MVP.**
- **US2 (Phase 4)**: depende do Foundational; **reusa os endpoints da US1** (kind=doc) — só testes+UI.
- **US3 (Phase 5)**: depende do Foundational; **estende `abrir` (T018) e o componente (T019)** criados na US1.

### User Story Dependencies

- **US1 (P1)**: independente após Foundational; entrega list+abrir+UI de aulas.
- **US2 (P2)**: funcionalmente independente; toca `ConteudoDia1.tsx` (após US1) e adiciona casos de teste.
- **US3 (P3)**: toca `app/api/evento/conteudo/[id]/abrir/route.ts` e `ConteudoDia1.tsx` (após US1) — sequenciar depois da US1.

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (TDD).
- Lib/leitura antes das rotas; rotas antes da UI.

### Parallel Opportunities

- **Foundational**: T003 (teste) ∥ T005 (engagement) ∥ T006 (teste ingest) — arquivos distintos; T004 depois de T003; T007 depois de T006.
- **US1**: T012 (componente) ∥ T013 (página) após as rotas T010/T011.
- **Polish**: T020 ∥ T021.
- ⚠️ Não paralelizar edições no mesmo arquivo: `ConteudoDia1.tsx` (T012/T016/T019); `abrir/route.ts` (T011/T018).

---

## Parallel Example: Foundational

```bash
Task: "T003 tests/content.release.test.ts (deve falhar)"
Task: "T005 'content.opened' em lib/engagement.ts"
Task: "T006 tests/conteudo.ingest.test.ts (deve falhar)"
```

## Parallel Example: User Story 1

```bash
# Após T010/T011 (rotas):
Task: "T012 components/ConteudoDia1.tsx (seção de aulas)"
Task: "T013 app/evento/conteudo/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Setup → 2. Foundational (CRÍTICA) → 3. US1 (aulas: list + abrir + UI).
4. **PARAR e VALIDAR**: aulas de nivelamento acessíveis no hub, medidas, com drip.
5. Demonstrar (MVP).

### Incremental Delivery

- Foundational (tabela + lib + ingestão) → base pronta.
- + US1 → aulas de nivelamento (MVP).
- + US2 → docs/presentes.
- + US3 → acesso ao CodeQuest (link externo).
- Polish → contrato §3, QA mobile, quickstart.

---

## Notes

- Nenhuma dependência externa nova; reúso do gate `hasCompletedSurvey` (8.12) e do emissor `emit()`.
- **1 tabela nova** (`content_items`) com `kind`; drip via `isReleased` em TS (pg-mem-safe).
- `resource` só é revelado pelo `abrir` (nunca listado) — protege docs-presente e a URL do CodeQuest.
- `content.opened` exige atualização coordenada da taxonomia FROZEN (CONTRIBUTING §3).
- CodeQuest abre **fora** da plataforma (nova aba) — exceção justificada à Constituição III (ver plan §Complexity).
- Verificar que cada teste falha antes de implementar; commitar por tarefa/grupo lógico.
