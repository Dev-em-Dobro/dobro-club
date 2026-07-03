# Implementation Plan: Acesso pré-ingresso (credencial provisória + hub do evento)

**Branch**: `feat/8.12-acesso-pre-ingresso` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.12-acesso-pre-ingresso/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0 (Next full-stack; Express aposentado).

## Summary

Quem se inscreveu no início da captação precisa **entrar e permanecer dentro da plataforma antes de
o ingresso existir** — o ingresso só é liberado **3 dias antes da semana do evento começar**. Esta
story entrega (a) um **hub/home do evento** para o lead autenticado (magic link), (b) uma **credencial
provisória** que é o **próprio ingresso da 8.3 computado num estado de pré-janela**, e (c) a
**convergência automática** para o ingresso oficial quando a janela abre (T-3 dias). O conteúdo dentro
do hub respeita o **gate da pesquisa (8.2)**.

**Abordagem técnica** — o princípio condutor (diretriz do usuário) é **“o fluxo do ingresso
continua”**: nada de entidade paralela. Como na 8.3 o ingresso é **derivado do lead** (`buildTicket`
em `lib/ingresso.ts` + `lib/ticket.ts`, sem tabela), a credencial provisória é o **mesmo ticket num
`phase` calculado** a partir de `now` vs. a janela do evento. Adiciona-se **um campo de data ao
evento** (`week_starts_at`) e uma função pura `ingressoPhase(event, now) → 'provisoria' | 'oficial'`.
A borda HTTP é um **Route Handler** `GET app/api/evento/route.ts` (autenticado por `dc_session`) que
devolve `{ lead, phase, ticket, windowOpensAt, surveyAnswered }`; a página `app/evento/page.tsx`
(client, `AuthProvider`) renderiza o hub mobile-first. O **gate da pesquisa** é lido de
`engagement_events` (`survey.completed` já é FROZEN na taxonomia), sem depender do armazenamento da
8.2 (ainda em Express). O acesso ao hub **emite** um evento de engajamento (Constituição IV).

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, React 19, Tailwind, `pg`; reúso de `lib/` já portada
(`db`, `leads`, `events`, `ingresso`, `ticket`, `engagement`, `auth/session`, `validate`). **Sem
novas dependências externas.**

**Storage**: PostgreSQL (Neon) via `query()` (`lib/db.ts`); `pg-mem` nos testes. **Uma coluna nova**
em `events` (`week_starts_at timestamptz`, nullable) via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

**Testing**: `vitest` + `pg-mem`. Route Handler testado importando/invocando a função exportada com um
`Request`; funções puras (`ingressoPhase`, gate) testadas isoladamente. Componentes com
`@testing-library/react` + jsdom (opcional nesta story).

**Target Platform**: Web mobile-first (PWA), Next single-origin.

**Project Type**: Aplicação Next.js full-stack (frontend + Route Handlers no mesmo app).

**Performance Goals**: hub + credencial visíveis em < 3s no mobile (SC-001); sem chamada bloqueante
(ticket é URL de transformação, herdado da 8.3); 60fps sem layout shift (Constituição I).

**Constraints**: camada de dados framework-agnostic e pg-mem-safe (id texto, sem FK, sem `GENERATED`,
sem índice parcial no caminho de teste); janela derivada em TS (não em coluna `GENERATED`); efeitos
externos (webhook via `emit`) best-effort e nunca bloqueiam; hub de um lead nunca exibido a outro
(sessão `dc_session`).

**Scale/Scope**: 1 evento ativo por vez, milhares de leads; **1 página + 1 Route Handler novos**, 2
funções puras novas (`ingressoPhase`, `hasCompletedSurvey`), 1 coluna de evento, reúso total do ticket.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Hub e credencial desenhados/validados a 375–430px, toque ≥44px, sem layout shift | ✅ atende |
| **II. Magic Link (sem senha)** | Hub exige `dc_session` (via `cookies()`); nenhuma tela de senha/cadastro; reúso do `app/entrar/[token]` | ✅ atende |
| **III. Ambiente Único** | Hub concentra o evento; nada redireciona pra fora (FR-010) | ✅ atende |
| **IV. Tudo é Mensurado** | Acesso ao hub emite via `emit()` → `engagement_events` + webhook (FR-011) | ⚠️ ver Complexity (tipo novo na taxonomia FROZEN) |
| **V. Test-First / TDD** | Testes (vitest + pg-mem) antes; funções puras + Route Handler invocado direto | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | `ingressoPhase`/gate puros; coluna via `ADD COLUMN IF NOT EXISTS`; `query()`; snake↔camel | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.12-acesso-pre-ingresso/` | ✅ atende |

**Pontos de atenção (Complexity Tracking):**
- **Novo tipo de engajamento `hub.viewed`** na taxonomia FROZEN (CONTRIBUTING §3) — exige atualização
  coordenada do contrato, como a 8.3 fez com `referral.signup`.
- **Novo campo `week_starts_at` no evento** — sem ele a janela não é calculável; degrada de forma
  segura (mantém credencial provisória, sem prometer data) quando ausente.
- **Gate lido de `engagement_events`** em vez do armazenamento nativo da 8.2 (Express) — escolha
  deliberada de desacoplamento (ver research).

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.12-acesso-pre-ingresso/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/evento-api.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
app/
├── evento/page.tsx                 # NOVO — hub do evento (client + AuthProvider), mobile-first (US1/US3)
└── api/
    └── evento/route.ts             # NOVO — GET (dc_session): { lead, phase, ticket, windowOpensAt, surveyAnswered } + emite hub.viewed

lib/                                # camada framework-agnostic (pg-mem-safe, TS)
├── ingresso.ts    # ESTENDER — ingressoPhase(event, now); credencial provisória reusa buildTicket
├── events.ts      # ESTENDER — mapear/expor week_starts_at (weekStartsAt); helper ingressoWindowOpensAt(event)
├── engagement.ts  # ESTENDER — hasCompletedSurvey(leadId); tipo 'hub.viewed' (taxonomia FROZEN — coordenar)
└── db.ts          # ESTENDER — ALTER TABLE events ADD COLUMN IF NOT EXISTS week_starts_at timestamptz

components/
└── EventoHub.tsx  # NOVO — casca do hub: credencial/ingresso + contagem p/ janela + gate da pesquisa

tests/
├── ingresso.phase.test.ts   # NOVO — provisoria vs oficial pela janela (T-3), borda e sem data
├── evento.route.test.ts     # NOVO — GET autenticado: phase correto, gate, idempotência, emite hub.viewed
└── survey-gate.test.ts      # NOVO — hasCompletedSurvey lê engagement_events(survey.completed)
```

**Structure Decision**: aplicação **Next.js App Router em TypeScript**, single-origin. A borda HTTP é
o Route Handler `app/api/evento/route.ts`; a lógica (janela, phase, gate) vive em `lib/`
framework-agnostic e testável com pg-mem. **Nenhuma entidade nova de ingresso** — reúso do derivado da
8.3 (`buildTicket`), coerente com a diretriz “o fluxo do ingresso continua”. O hub é uma **nova área
logada** (`app/evento`), distinta do `app/meu-acesso` (que é a confirmação de acesso), seguindo o
mesmo padrão `AuthProvider` + `/api/*`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Novo tipo `hub.viewed` na taxonomia FROZEN | FR-011 exige medir o acesso ao hub pré-evento (Constituição IV) | Reusar um tipo existente falsearia a métrica; omitir violaria “tudo é mensurado”. Atualiza-se o contrato §3 de forma coordenada (precedente: `referral.signup` na 8.3) |
| Coluna `week_starts_at` no evento | A janela T-3 e a contagem no hub dependem da data de início da semana | Hardcode/env global impede múltiplos eventos e não é testável; coluna nullable com degradação segura é mínima |
| Gate lido de `engagement_events` (não do store da 8.2) | 8.2 ainda é Express; `survey.completed` já é FROZEN e persistido | Portar o armazenamento da pesquisa agora ampliaria o escopo; ler o evento de engajamento é suficiente para o gate booleano |
