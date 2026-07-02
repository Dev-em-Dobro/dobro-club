# Implementation Plan: Ingresso/Credencial compartilhável com indicação por QR

**Branch**: `feat/8.3-ingresso` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.3-ingresso/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — conforme Constituição v2.0.0 (migração total;
Next assume o backend, Express aposentado).

## Summary

A geração do ingresso é o próprio ponto de captação: um visitante informa nome, e-mail e telefone,
escolhe foto ou avatar padrão, e recebe (a) um ingresso visual com a identidade do evento e (b) um
magic link pessoal exibido na tela (mesma sessão) + e-mail. O ingresso é baixável e compartilhável e
carrega um **QR code público** que leva outra pessoa a gerar o próprio ingresso — atribuindo a
indicação a quem compartilhou.

**Abordagem técnica**: **Route Handler** público de captação (`app/api/e/[slug]/ingresso/route.ts`)
que usa a camada de dados em `lib/` (create-or-get lead idempotente por e-mail **ou** telefone) e o
magic link; a foto vai direto do cliente para o Cloudinary (upload não assinado) e o ingresso é uma
**URL de transformação do Cloudinary** (sem chamada bloqueante no servidor); o QR é gerado no cliente
e o download é composto via canvas. Após gerar, uma **rota `app/ingresso/pronto`** exibe o magic link
na mesma sessão (FR-005); a recuperação (`app/api/e/[slug]/ingresso/recuperar/route.ts`) **reenvia por
e-mail** com resposta neutra (FR-017/FR-018). Compartilhar e chegar por indicação emitem eventos de
engajamento (`ticket.shared`, `referral.signup`) via um **emissor compartilhado** (`lib/engagement.ts`
+ tabela `engagement_events`), seguindo o contrato FROZEN do CONTRIBUTING §3.

> **Consequência da migração**: como 8.1 (magic link/auth/data layer) ainda vive no Express, a **Fase
> Foundational desta story bootstrapa a base Next+TS compartilhada** (`lib/db.ts`, `lib/leads.ts`,
> `lib/events.ts`, `lib/auth/*`, `lib/email.ts`, `lib/webhook.ts`, `lib/validate.ts` e o
> `app/entrar/[token]`) portando o comportamento já testado do Express. É trabalho compartilhado —
> review cruzado obrigatório.

## Transição da Stack (Express → Next) — resolve F1

**Decisão**: migração **Next.js full-stack, sem coexistência de runtimes**. Não há proxy do Next para
o Express nem dois servidores em paralelo — as rotas legadas são **reimplementadas como Route
Handlers do Next**, não encaminhadas.

**Sequenciamento (para não deployar rotas legadas quebradas):**
1. A 8.3 entrega, na Foundational, o **porte da base compartilhada** (auth/data/email/webhook +
   `app/entrar/[token]`) → equivale a migrar o núcleo da **8.1**.
2. **8.2 (pesquisa)** e **8.4 (aulas)** são reimplementadas em Next em **esforço próprio** (specs/tasks
   dedicados) — são **pré-requisitos do cutover de produção**, não do desenvolvimento da 8.3.
3. **Cutover**: o Express só é **aposentado** quando 8.1(portada)/8.2/8.4 estiverem em Next. Até lá,
   **não** se faz deploy single-origin Next que remova as rotas de 8.2/8.4; o desenvolvimento da 8.3
   segue em Next normalmente.

**Rationale**: aproveita o Next como framework full-stack (App Router + Route Handlers) sem manter um
segundo runtime; evita o hack de proxy (rejeitado em research D9) e mantém o single-origin como
estado final. O custo é sequenciar a migração de 8.2/8.4 antes de desligar o Express.

## Technical Context

**Language/Version**: **TypeScript** (strict), Node.js. React 19 via Next.js.

**Primary Dependencies**: **Next.js (App Router)**, React 19, Tailwind, `pg`, `resend`; util de rate
limit. **Novas**: `qrcode` (QR no cliente); Cloudinary via **URL de transformação + upload não
assinado** (sem SDK no servidor).

**Storage**: PostgreSQL (Neon) via `DATABASE_URL`; `pg-mem` em memória nos testes. Fotos no Cloudinary
(fora do Postgres — guardamos só a URL/`public_id`).

**Testing**: `vitest` + `pg-mem` (sem `supertest`). Route Handlers são testados **importando e
invocando** a função exportada com um `Request` (sem servidor real). Componentes com
`@testing-library/react` + ambiente jsdom.

**Target Platform**: Web mobile-first (PWA), Next single-origin (Node/hosting).

**Project Type**: Aplicação Next.js full-stack (frontend + Route Handlers no mesmo app).

**Performance Goals**: ingresso gerado e exibido em < 90s ponta a ponta (SC-001); transições mobile a
60fps sem layout shift (Constituição I).

**Constraints**: camada de dados **framework-agnostic** e pg-mem-safe (ids texto via `newId`, sem FK,
sem `GENERATED`, sem índice parcial no caminho de teste); toda query por `query()` (`lib/db.ts`);
efeitos externos (Cloudinary, webhook, e-mail) best-effort e **nunca bloqueiam** a resposta; QR
**jamais** vaza a sessão do dono (SC-006).

**Scale/Scope**: 1 evento de lançamento ativo por vez, milhares de leads; ~3 rotas de página + 3
Route Handlers novos + emissor compartilhado + bootstrap da base `lib/` (portada da 8.1).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Páginas desenhadas/validadas a 375–430px, toque ≥44px, sem layout shift | ✅ atende |
| **II. Magic Link (sem senha)** | Acesso via `app/entrar/[token]` + cookie `dc_session` (`cookies()` do Next); recuperação reenvia por e-mail (nunca exibe p/ e-mail digitado) | ✅ atende |
| **III. Ambiente Único** | Download/compartilhar usa share sheet do SO; nada redireciona pra fora | ✅ atende |
| **IV. Tudo é Mensurado** | `ticket.shared` e `referral.signup` via `emit()` → `engagement_events` + webhook (contrato §3) | ✅ atende |
| **V. Test-First / TDD** | Testes (vitest + pg-mem) antes; borda testada invocando Route Handlers | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | `lib/*` puro, `newId`, sem FK, `query()`, snake↔camel, external best-effort, TS | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.3-ingresso/` | ✅ atende |

**Pontos de atenção (Complexity Tracking):**
- Route Handler **público sem `X-Api-Key`** — visitante não tem chave; mitigado por rate limit +
  validação + consentimento.
- **Emissor de engajamento entregue por esta story** — coordenar com o Trilho A (dono do scoring).
- **Bootstrap da base Next+TS** (porte da 8.1) dentro da Foundational — necessário porque 8.1 ainda é
  Express; é trabalho compartilhado (review cruzado).

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.3-ingresso/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/ingresso-api.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
app/
├── ingresso/page.tsx                         # form (nome/email/telefone) + foto|avatar + consent + ?ref=  (US1)
├── ingresso/pronto/page.tsx                  # exibe magic link + ingresso (mesma sessão) (US1/US2)
├── recuperar-link/page.tsx                   # recuperação por e-mail, resposta neutra (US1)
├── entrar/[token]/route.ts                   # magic link → seta cookie dc_session (porte da 8.1)
└── api/
    ├── e/[slug]/ingresso/route.ts            # POST público: gerar ingresso + indicação (US1/US3)
    ├── e/[slug]/ingresso/recuperar/route.ts  # POST público: reenvio por e-mail (US1)
    └── ingresso/share/route.ts               # POST (dc_session): emite ticket.shared (US2)

lib/                                          # camada framework-agnostic (pg-mem-safe, TS)
├── db.ts            # query(), setPool, SCHEMA, initSchema  (porte de server/db.js)
├── leads.ts         # createOrGetLead, getLeadByEmail, setPhoto, setReferrer, newId, mapLead
├── events.ts        # getEvent, getEventBySlug, verifyApiKey
├── engagement.ts    # NOVO — emit(eventId, leadId, type, data): persiste + webhook best-effort
├── ingresso.ts      # NOVO — dados do ticket + resolveReferrer (validação de indicador)
├── ticket.ts        # NOVO — buildTicketImageUrl + qrValue + composição canvas (usado no cliente)
├── auth/token.ts    # buildMagicLink, generateToken   (porte da 8.1)
├── auth/session.ts  # signSession, verifySession + helpers de cookie via next  (porte da 8.1)
├── email.ts · webhook.ts · validate.ts · ratelimit.ts   (porte da 8.1)

components/
├── IngressoForm.tsx     # NOVO — form controlado, upload não assinado, consent
└── TicketCard.tsx       # NOVO — imagem Cloudinary + QR + download (canvas) + share

tests/
├── ingresso.route.test.ts       # NOVO — captação + magic link + idempotência + indicação
├── ingresso.recuperar.test.ts   # NOVO — reenvio + resposta neutra
├── engagement.test.ts           # NOVO — emit() persiste + webhook best-effort
├── ingresso.share.test.ts       # NOVO — ticket.shared por canal
├── leads.test.ts · events.test.ts   # base portada (getLeadByEmail, getEventBySlug, mapLead)
└── components/TicketCard.test.tsx   # NOVO — render QR + download + share
```

**Structure Decision**: aplicação **Next.js App Router em TypeScript**, single-origin. A borda HTTP
são **Route Handlers** (`app/api/**/route.ts` e `app/entrar/[token]/route.ts`); toda a lógica de
negócio e dados vive em **`lib/`** framework-agnostic (testável com pg-mem sem servidor). A base
compartilhada da 8.1 (data layer, auth/sessão, magic link, e-mail, webhook) é **portada para `lib/`**
na Foundational, pois esta é a primeira story em Next.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Route Handler público sem `X-Api-Key` | Visitante que gera o ingresso não possui chave; funil de captação público | Exigir chave inviabiliza a captação pelo participante; mitigado por rate limit + validação + consentimento |
| Emissor `lib/engagement.ts` entregue nesta story | 8.3 é a 1ª feature a emitir (`ticket.shared`); o emissor da Fase 0 ainda não existe | Bloquear 8.3 até um PR separado atrasaria o trilho; entregamos o emissor mínimo seguindo o contrato FROZEN §3 |
| Bootstrap da base Next+TS (porte da 8.1) na Foundational | 8.3 é a 1ª story em Next; magic link/auth/data layer ainda são Express | Reescrever do zero perderia o comportamento já testado da 8.1; portamos preservando os contratos e testes |
| Dep. Cloudinary + QR (`qrcode`) | Ingresso visual + QR de indicação são o núcleo | Compor imagem no servidor (sharp) adiciona peso e bloqueio; usamos URL de transformação + QR no cliente |
