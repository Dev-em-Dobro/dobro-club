# Tasks: Ingresso/Credencial compartilhável com indicação por QR

**Input**: Design documents from `specs/epic-8/8.3-ingresso/`

**Stack**: **Next.js (App Router) + TypeScript** (Constituição v2.0.0). Route Handlers no backend;
camada de dados framework-agnostic em `lib/`; testes vitest + pg-mem (sem supertest).

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ingresso-api.md](./contracts/ingresso-api.md)

**Tests**: INCLUÍDOS — TDD é não-negociável (Constituição V). Teste escrito **antes**, falhando, e só
então implementado. A borda HTTP é testada **importando e invocando** o Route Handler com um `Request`.

**Organization**: por user story (P1→P3), cada uma entregável e testável de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 / US2 / US3. Setup/Foundational/Polish sem label.

## Path Conventions

App Next.js: páginas e Route Handlers em `app/`, lógica/dados em `lib/`, UI em `components/`, testes
em `tests/` (`.ts`/`.tsx`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicializar o app Next.js + TS e dependências antes de qualquer código.

- [X] T001 Inicializar o app **Next.js (App Router) + TypeScript** na raiz (`tsconfig.json` strict, `next.config.mjs`, Tailwind v4 via `@tailwindcss/postcss`, casca `app/`) — base da migração. `tsc --noEmit` e `next build` verdes.
- [X] T002 [P] **vitest + pg-mem** para TS: reuso da config existente em `vite.config.js` (`root: '.'`, env node + opt-in jsdom por arquivo; `@vitejs/plugin-react` cobre `.tsx`); pega `tests/**/*.test.ts(x)`
- [X] T003 [P] Adicionar dependência `qrcode` (+ `@types/qrcode`) ao [package.json](../../../package.json) e instalar
- [X] T004 [P] Documentar config Cloudinary em [.env.example](../../../.env.example): `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, upload preset **não assinado** por evento, `public_id` do template + `NEXT_PUBLIC_BASE_URL` (research D1/D3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: bootstrapar a base Next+TS compartilhada (porte da 8.1 → `lib/`), o schema, o emissor de
engajamento e os helpers que TODAS as stories usam.

**⚠️ CRITICAL**: nenhuma story começa antes desta fase. É **trabalho compartilhado (Fase 0)**.

> **F3 — PR de Fase 0 (obrigatório):** a Constituição exige que a Fase 0 compartilhada (auth, camada
> de dados, emissor de eventos) esteja na `main` **antes** de qualquer feature branch. Portanto
> **T005–T015 vão em um PR próprio** ("chore(8.3): Fase 0 — base Next+TS + emissor"), com **review
> cruzado do Trilho A** (dono do scoring que consome os eventos), mergeado **antes** de iniciar US1
> (T016+). Taxonomia de eventos é FROZEN (§3) — não alterar sozinho.

### Porte da base 8.1 (framework-agnostic → `lib/`)

- [ ] T005 Portar a camada de dados para `lib/db.ts`: `query()`, `setPool` (pg-mem injeta nos testes), `SCHEMA`, `initSchema` (statements idempotentes com try/catch nos índices)
- [ ] T006 [P] Portar `lib/auth/token.ts` (`generateToken`, `buildMagicLink`) e `lib/auth/session.ts` (`signSession`, `verifySession`) com helpers de cookie via `cookies()` do Next
- [ ] T007 [P] Portar `lib/email.ts` (`sendMagicLinkEmail`, Resend), `lib/webhook.ts` (best-effort), `lib/validate.ts` (`validateLeadInput`), `lib/ratelimit.ts`
- [ ] T008 [P] Teste (falhando) `tests/leads.test.ts`: `createOrGetLead` (idempotente e-mail OU telefone), `getLeadByEmail`, `setPhoto`, `setReferrer`, `mapLead` com `photoUrl`/`referrerLeadId`
- [ ] T009 [P] Teste (falhando) `tests/events.test.ts`: `getEvent`, `getEventBySlug` (null p/ slug inexistente), `verifyApiKey`
- [ ] T010 Implementar `lib/leads.ts` (porte + novos helpers/campos); fazer T008 passar
- [ ] T011 Implementar `lib/events.ts` (porte + `getEventBySlug`); fazer T009 passar
- [ ] T012 Implementar `app/entrar/[token]/route.ts`: valida token, seta cookie `dc_session`, redireciona pro evento (porte do `/entrar/:token`)

### Schema + emissor (novos)

- [ ] T013 Estender o schema em `lib/db.ts`: colunas `photo_url text` e `referrer_lead_id text` em `leads` (+ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` idempotente); tabela `engagement_events` + índices não-parciais (contrato FROZEN §3)
- [ ] T014 [P] Teste (falhando) `tests/engagement.test.ts`: `emit()` persiste linha em `engagement_events` (id `engev_…`, type, data) **e** dispara webhook best-effort sem bloquear (falha não propaga)
- [ ] T015 Implementar `lib/engagement.ts` com `emit(eventId, leadId, type, data)` — persiste via `query()` + webhook best-effort (reuso de `lib/webhook.ts`); fazer T014 passar

**Checkpoint**: base Next+TS + schema + emissor verdes — stories podem começar.

---

## Phase 3: User Story 1 - Gerar meu ingresso e entrar no evento (Priority: P1) 🎯 MVP

**Goal**: visitante preenche nome/e-mail/telefone, escolhe foto ou avatar, recebe o ingresso e o
magic link (na tela + e-mail); pode recuperar o link por e-mail. Gancho de conversão.

**Independent Test**: form com avatar padrão → ingresso com o nome + magic link na tela; abrir o link
entra no evento; repetir com mesmo e-mail/telefone não duplica; recuperar por e-mail reenvia neutro.

### Tests for User Story 1 (write FIRST, ensure they FAIL) ⚠️

- [X] T016 [P] [US1] Teste `tests/ingresso.route.test.ts`: invocar `POST` de `app/api/e/[slug]/ingresso` cria lead, retorna `{leadId,isNew,magicLink,ticket.imageUrl}`, envia e-mail best-effort; **idempotente por e-mail OU telefone**; `consent!==true` → 400; e-mail/telefone inválido → 400; slug inexistente → 404 (FR-001,002,004,005,013,014)
- [X] T017 [P] [US1] Teste `tests/ingresso.recuperar.test.ts`: `POST` de `.../recuperar` reenvia link ao e-mail cadastrado; resposta **neutra** idêntica p/ e-mail existente e inexistente; corpo **nunca** contém `magicLink`/`leadId` (FR-017,018, SC-006)
- [ ] T018 [P] [US1] Teste `tests/components/IngressoForm.test.tsx`: valida campos, avatar como default, bloqueia sem consentimento, submete; **rejeita foto > 5MB e formato fora de JPEG/PNG/WebP → fallback avatar** (FR-003,013,015,016)
- [ ] T019 [P] [US1] Teste da página pronto `tests/ingresso.pronto.test.tsx`: exibe o magic link + imagem do ingresso (foto ou avatar) na mesma sessão (FR-005)
- [ ] T020 [P] [US1] Teste `tests/recuperar.page.test.tsx`: submit mostra mensagem neutra, sem exibir link (FR-017,018)

### Implementation for User Story 1

- [X] T021 [P] [US1] Implementar `lib/ticket.ts`: `buildTicketImageUrl(lead)` (URL de transformação Cloudinary: template + nome + foto|avatar) + constante do avatar padrão (research D1)
- [X] T022 [US1] Implementar `lib/ingresso.ts`: montar `ticket` (imageUrl) do response — reuso pelos Route Handlers
- [X] T023 [US1] Implementar `app/api/e/[slug]/ingresso/route.ts` (`POST` público, rate limit): `getEventBySlug`, `validateLeadInput`, `createOrGetLead`, `setPhoto` se `isNew`, `buildMagicLink`, envio de e-mail best-effort, retorno com `magicLink` + `ticket`; fazer T016 passar (FR-001..005,013,014)
- [X] T024 [US1] Implementar `app/api/e/[slug]/ingresso/recuperar/route.ts` (`POST` público, rate limit estrito): `getLeadByEmail`, reenvio best-effort de `sendMagicLinkEmail`, resposta neutra; fazer T017 passar (FR-017,018)
- [X] T025 [P] [US1] Implementar `components/IngressoForm.tsx`: form mobile-first (toque ≥44px), toggle foto|avatar com **upload não assinado** ao Cloudinary, checkbox de consentimento, captura de `?ref=` e repasse (FR-003,013,015,016)
- [X] T026 [US1] Implementar `app/ingresso/page.tsx`: renderiza `IngressoForm`, submete ao Route Handler e navega p/ pronto
- [X] T027 [US1] Implementar `app/ingresso/pronto/page.tsx`: exibir magic link + imagem do ingresso (via `lib/ticket.ts`) na mesma sessão (FR-005)
- [X] T028 [US1] Implementar `app/recuperar-link/page.tsx`: input de e-mail → chama `/recuperar` → mensagem neutra (FR-017,018)
- [X] T029 [US1] Tratar upload inválido de foto em `components/IngressoForm.tsx`: rejeitar **> 5MB** e formatos fora de **JPEG/PNG/WebP** (e erro de upload) com mensagem e **fallback ao avatar**, sem travar a geração (FR-015)

**Checkpoint**: US1 funcional e testável sozinha — MVP entregável (gerar + acessar + recuperar).

---

## Phase 4: User Story 2 - Compartilhar meu ingresso (Priority: P2)

**Goal**: baixar o ingresso como imagem (com QR público) e compartilhar em redes/WhatsApp,
registrando `ticket.shared`. O QR nunca dá acesso à conta do dono.

**Independent Test**: com ingresso gerado, baixar → PNG contém QR; compartilhar → `ticket.shared`
registrado; escanear o QR → cai na tela de geração, não loga como o dono.

### Tests for User Story 2 (write FIRST, ensure they FAIL) ⚠️

- [ ] T030 [P] [US2] Teste `tests/ingresso.share.test.ts`: `POST` de `app/api/ingresso/share` exige `dc_session`; emite `ticket.shared {channel}`; sem sessão → 401; sem channel → 400 (FR-011)
- [ ] T031 [P] [US2] Teste `tests/components/TicketCard.test.tsx`: renderiza QR de `qrValue`; download compõe imagem+QR (canvas); botão compartilhar chama `/share`; `qrValue = <origin>/ingresso?ref=<leadId>` (público, sem token) (FR-006,007,008, SC-006)

### Implementation for User Story 2

- [ ] T032 [US2] Estender `lib/ticket.ts`: `qrValue(lead)` = `${origin}/ingresso?ref=${lead.id}` + composição via `<canvas>` (fundo Cloudinary + QR do `qrcode`) para o download (research D2)
- [ ] T033 [US2] Implementar `components/TicketCard.tsx`: imagem do ingresso + QR sobreposto, botão **baixar** (canvas→PNG) e **compartilhar** (Web Share API) chamando `POST /api/ingresso/share` (FR-006,007)
- [ ] T034 [US2] Integrar `TicketCard` em `app/ingresso/pronto/page.tsx` (substituir a imagem base pela credencial completa com QR)
- [ ] T035 [US2] Implementar `app/api/ingresso/share/route.ts` (`POST`, cookie `dc_session` via `cookies()`): resolver lead da sessão, `emit(eventId, leadId, 'ticket.shared', {channel})` best-effort; fazer T030 passar (FR-011)

**Checkpoint**: US1 + US2 independentes; ingresso circula com QR público.

---

## Phase 5: User Story 3 - Chegar por indicação e ter a indicação atribuída (Priority: P3)

**Goal**: quem gera a partir do QR de um amigo fica registrado como indicado por ele; emite
`referral.signup`. Auto-indicação e indicador inexistente são ignorados. O QR do novo ingresso
carrega o id do novo dono (ciclo).

**Independent Test**: abrir `/ingresso?ref=<leadId>` e gerar → novo lead com `referrer_lead_id` = ref
+ `referral.signup {referrerLeadId}`; `ref` = próprio ou inexistente → lead criado sem atribuição.

### Tests for User Story 3 (write FIRST, ensure they FAIL) ⚠️

- [ ] T036 [P] [US3] Teste (estende) `tests/ingresso.route.test.ts`: geração com `ref` válido grava `referrer_lead_id` + emite `referral.signup {referrerLeadId}`; auto-indicação e `ref` inexistente → lead criado **sem** atribuição, sem evento (FR-008,009,010,012)

### Implementation for User Story 3

- [ ] T037 [US3] Implementar `resolveReferrer(eventId, ref, newLeadId)` em `lib/ingresso.ts` → ref válido (existe no evento **e** ≠ novo lead) ou null (FR-010)
- [ ] T038 [US3] Estender `app/api/e/[slug]/ingresso/route.ts`: se `isNew` e `resolveReferrer` válido → `setReferrer` + `emit(eventId, leadId, 'referral.signup', {referrerLeadId})`; ignorar inválido/self; fazer T036 passar (FR-009,010,012)
- [ ] T039 [US3] Confirmar em `components/IngressoForm.tsx` que `?ref=` é capturado/repassado e que o QR gerado (`lib/ticket.ts`) carrega o `leadId` do novo dono (fecha o ciclo — FR-008)

**Checkpoint**: as três stories independentes; ciclo viral completo.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T040 [P] Rodar os cenários de [quickstart.md](./quickstart.md) (US1→US3 + recuperação) e registrar resultados
- [ ] T041 [P] Passo mobile-first: validar todas as páginas novas a 375–430px, toque ≥44px, 60fps sem layout shift (FR-016, Constituição I)
- [ ] T042 Rodar `npm test` completo verde + `tsc --noEmit` + garantir Cloudinary/e-mail/webhook best-effort **não bloqueiam** a resposta (Constituição VI)
- [ ] T043 [P] Verificar em [CONTRIBUTING.md](../../../CONTRIBUTING.md) §3 que `ticket.shared` e `referral.signup` refletem o payload implementado (coordenação com Trilho A/8.7)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: sem dependências — começa já (inicializa o app Next+TS).
- **Foundational (P2)**: depende do Setup — **BLOQUEIA** todas as stories (base `lib/` portada +
  schema + emissor). Trabalho compartilhado — review cruzado.
- **User Stories (P3+)**: dependem da Foundational. Depois podem paralelizar.
- **Polish (P6)**: depois das stories desejadas.

### User Story Dependencies

- **US1 (P1)**: só depende da Foundational. É o MVP. Não depende de US2/US3.
- **US2 (P2)**: depende da Foundational (usa `emit`) e reusa a página `pronto` da US1.
- **US3 (P3)**: depende da Foundational (usa `emit`) e estende o Route Handler de geração da US1 (`ref`).

### Within Each User Story

- Testes escritos e **falhando** antes da implementação (TDD, Constituição V).
- `lib/` antes dos Route Handlers; Route Handlers antes das páginas/UI.
- Efeitos externos best-effort; nunca bloquear a resposta.

### Parallel Opportunities

- Setup: T002, T003, T004 em paralelo (após T001 inicializar o app).
- Foundational: T006/T007 em paralelo; testes T008/T009/T014 em paralelo; implementações em arquivos
  distintos paralelizam após seus testes.
- US1: testes T016–T020 em paralelo; `lib/ticket.ts` (T021) e `IngressoForm` (T025) em paralelo.
- Entre stories: com a Foundational pronta, US1/US2/US3 por devs diferentes — sequenciar edições no
  arquivo compartilhado `app/api/e/[slug]/ingresso/route.ts` (T023 e T038).

---

## Parallel Example: User Story 1

```bash
# Escrever os testes da US1 juntos (todos devem FALHAR primeiro):
Task: "T016 tests/ingresso.route.test.ts"
Task: "T017 tests/ingresso.recuperar.test.ts"
Task: "T018 tests/components/IngressoForm.test.tsx"
Task: "T019 tests/ingresso.pronto.test.tsx"
Task: "T020 tests/recuperar.page.test.tsx"

# Depois, lib + UI independentes em paralelo:
Task: "T021 lib/ticket.ts"
Task: "T025 components/IngressoForm.tsx"
```

---

## Implementation Strategy

### MVP First (só US1)

1. Phase 1 (Setup Next+TS) → 2. Phase 2 (Foundational — porte da base + schema + emissor) →
   3. Phase 3 (US1).
4. **PARAR e VALIDAR**: gerar ingresso + acessar + recuperar funcionando sozinho.
5. Deploy/demo — inscrição do evento funcionando na nova stack.

### Incremental Delivery

1. Setup + Foundational → base Next+TS pronta.
2. US1 → testar → deploy (MVP: ingresso é a inscrição).
3. US2 → compartilhamento + QR → testar → deploy (viralização).
4. US3 → atribuição de indicação → testar → deploy (ciclo viral mensurável, insumo p/ 8.7).

### Parallel Team Strategy (2 devs — trunk-based leve)

1. Fazer Setup + Foundational juntos (base compartilhada — review cruzado).
2. Depois: Dev A toca US1; Dev B prepara US2/US3. Sequenciar edições em `app/api/e/[slug]/ingresso/route.ts`.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Todo teste deve **falhar antes** de implementar (Constituição V); borda HTTP testada invocando o
  Route Handler com `Request` (sem servidor).
- Convenções pg-mem-safe: ids texto via `newId`, sem FK, sem índice parcial no caminho de teste,
  `query()` em `lib/db.ts`, snake↔camel, efeitos externos best-effort (Constituição VI).
- Base 8.1 portada preserva comportamento/contratos; 8.2 e 8.4 migram em esforço próprio depois.
- Feature branch `feat/8.3-ingresso`; PR pequeno + review cruzado; contrato de eventos é **FROZEN**.
