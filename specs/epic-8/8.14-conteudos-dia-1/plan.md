# Implementation Plan: Conteúdos dia-1 (nivelamento + docs + acesso ao CodeQuest)

**Branch**: `feat/8.14-conteudos-dia-1` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.14-conteudos-dia-1/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0 (Next full-stack; Express aposentado).

## Summary

Entrega o **conteúdo de aquecimento (dia-1)** dentro do hub pré-evento (8.12), atrás do **gate da
pesquisa** (8.2): **aulas de nivelamento** (vídeo embedado na plataforma), **docs/materiais** (incl.
docs com presentes) e um **ponto de acesso ao CodeQuest** (link externo). A liberação é **drip por
data (agendado)**: cada item fica acessível quando **o gate está satisfeito E a data de liberação
chegou**; antes disso aparece como "em breve" com a data.

**Abordagem técnica** — um **modelo único** `content_items` com discriminador `kind`
(`lesson`|`doc`|`codequest`), `release_at` (drip) e `resource` (embed/URL/URL externa). A leitura vive
em `lib/content.ts` (framework-agnostic, pg-mem-safe): `listContentItems`, `isReleased`, mapeamento
snake↔camel. Três Route Handlers: **`GET /api/evento/conteudo`** (lead) lista os itens já **filtrando
resource de itens bloqueados** (gate + data); **`POST /api/evento/conteudo/[id]/abrir`** (lead) valida
gate+release, **emite `content.opened`** e devolve o `resource` (vídeo/doc/URL do CodeQuest);
**`POST /api/events/[eventId]/conteudo`** (admin `X-Api-Key`) provisiona itens (sem admin UI, como
8.4). O gate reutiliza **`hasCompletedSurvey`** (8.12). A UI é `app/evento/conteudo` +
`components/ConteudoDia1.tsx`; o CTA do hub (8.12) passa a apontar para lá.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, React 19, Tailwind, `pg`; reúso de `lib/` (`db`, `events`,
`leads`, `engagement`, `auth/session`). Vídeo de nivelamento = **embed YouTube** (stack de vídeo da
Constituição). **Sem novas dependências externas.**

**Storage**: PostgreSQL (Neon) via `query()`; `pg-mem` nos testes. **Nova tabela** `content_items`
(pg-mem-safe: id texto, sem FK, sem `GENERATED`/índice parcial no caminho de teste).

**Testing**: `vitest` + `pg-mem`. Route Handlers testados importando/invocando a função; `isReleased`
e mapeamentos testados isolados. Auth de lead via `NextRequest` + `signSession` (padrão estabelecido
na 8.12); auth admin via header `X-Api-Key`.

**Target Platform**: Web mobile-first (PWA), Next single-origin.

**Performance Goals**: hub de conteúdo visível em < 3s no mobile (SC-001); vídeo por embed (sem peso
no servidor); 60fps sem layout shift.

**Constraints**: camada de dados framework-agnostic e pg-mem-safe; `release_at` avaliado em TS (sem
coluna `GENERATED`); `resource` de item bloqueado **nunca** é exposto (gate + data); efeitos externos
(webhook via `emit`) best-effort; auth por tipo de rota (cookie `dc_session` p/ lead, `X-Api-Key` p/
admin).

**Scale/Scope**: 1 evento ativo, dezenas de itens de conteúdo, milhares de leads. **1 tabela + 3
Route Handlers + 1 página + 1 componente + 1 lib novos**; edição mínima no hub (8.12) e na taxonomia.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Conteúdo desenhado/validado a 375–430px, toque ≥44px, sem layout shift | ✅ atende |
| **II. Magic Link (sem senha)** | Conteúdo do lead exige `dc_session`; nenhuma senha/cadastro | ✅ atende |
| **III. Ambiente Único** | Aulas por embed e docs na plataforma; **CodeQuest = link externo** | ⚠️ **violação justificada** (ver Complexity) |
| **IV. Tudo é Mensurado** | Abrir item emite `content.opened` via `emit()` (FR-007) | ⚠️ novo tipo na taxonomia FROZEN (ver Complexity) |
| **V. Test-First / TDD** | Testes (vitest + pg-mem) antes; funções puras + Route Handlers invocados direto | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | `content_items` id texto/sem FK; `isReleased` em TS; `query()`; snake↔camel; `X-Api-Key` no admin | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.14-conteudos-dia-1/` | ✅ atende |

**Pontos de atenção (Complexity Tracking):**
- **CodeQuest abre fora da plataforma** (link externo) — exceção explícita à Constituição III,
  **decidida em `/speckit-clarify`**; mitigada (abre em nova aba, acesso medido, escopo só link).
- **Novo tipo `content.opened`** na taxonomia FROZEN (CONTRIBUTING §3) — mudança coordenada.
- **Nova tabela `content_items`** — 1ª feature de conteúdo persistido em Next.

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.14-conteudos-dia-1/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/conteudo-api.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
app/
├── evento/conteudo/page.tsx                 # NOVO — página de conteúdo (client + AuthProvider) (US1/US2/US3)
├── evento/page.tsx                          # ESTENDER (8.12) — CTA do hub → /evento/conteudo
└── api/
    ├── evento/conteudo/route.ts             # NOVO GET (dc_session): lista itens, oculta resource bloqueado
    ├── evento/conteudo/[id]/abrir/route.ts  # NOVO POST (dc_session): valida gate+release, emite content.opened, devolve resource
    └── events/[eventId]/conteudo/route.ts   # NOVO POST (X-Api-Key): ingestão de itens (sem admin UI)

lib/                                         # camada framework-agnostic (pg-mem-safe, TS)
├── content.ts     # NOVO — ContentItem/kind; listContentItems, getContentItem, createContentItem, isReleased, mapContentItem
├── engagement.ts  # ESTENDER — tipo 'content.opened' (taxonomia FROZEN — coordenar)
└── db.ts          # ESTENDER — CREATE TABLE content_items + índices skippable

components/
├── ConteudoDia1.tsx  # NOVO — 3 seções (aulas/docs/CodeQuest) + estados locked/"em breve"
└── EventoHub.tsx     # ESTENDER (8.12) — apontar CTA para /evento/conteudo

tests/
├── content.release.test.ts   # NOVO — isReleased: sem data ⇒ liberado; data futura ⇒ bloqueado; borda
├── conteudo.route.test.ts     # NOVO — GET: gate, release, NÃO vaza resource de item bloqueado, ordena
├── conteudo.abrir.test.ts     # NOVO — POST abrir: 403 se bloqueado/gate; emite content.opened; devolve resource
└── conteudo.ingest.test.ts    # NOVO — POST admin: 401 sem X-Api-Key; cria item válido
```

**Structure Decision**: **Next.js App Router em TypeScript**, single-origin. Modelo **único**
`content_items` com `kind` (evita 3 tabelas e mantém o drip/gate uniforme). Borda HTTP fina (Route
Handlers); regras (release, gate, ocultar resource) em `lib/`. UI é uma **nova área** `app/evento/
conteudo` sob o hub da 8.12, reusando `AuthProvider` e o gate `hasCompletedSurvey`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| **CodeQuest abre fora da plataforma** (viola Constituição III) | Decisão de produto (`/speckit-clarify`): CodeQuest é produto separado, não embedável nesta story; entregar só o acesso | Embedar/portar o CodeQuest agora estoura o escopo; mitiga-se abrindo em nova aba, medindo o acesso (`content.opened`) e limitando ao link |
| Novo tipo `content.opened` na taxonomia FROZEN | FR-007 exige medir cada acesso a conteúdo (Constituição IV) | Reusar `lesson.started` (8.4) falsearia o scoring de aulas do evento; um tipo único cobre os 3 kinds |
| Nova tabela `content_items` | Conteúdo precisa persistir com `kind`, `release_at` e `resource` | Config/env não suporta CRUD por evento nem drip testável; tabela única (não 3) é o mínimo |
| Modelo único com `kind` (vs. 3 tabelas) | Drip + gate + listagem uniformes para os 3 tipos | 3 tabelas triplicariam queries/rotas/testes sem ganho — o comportamento é o mesmo, só muda `resource` |
