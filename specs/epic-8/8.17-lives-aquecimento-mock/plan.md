# Implementation Plan: Lives de aquecimento (mockadas) com agenda e medição de engajamento

**Branch**: `feat/8.17-lives-aquecimento-mock` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.17-lives-aquecimento-mock/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0.

## Summary

Adiciona uma seção **Lives de aquecimento** (pré-evento, **mockadas**) com **agenda** e **estado
derivado do horário** (agendada → ao vivo → gravação → encerrada), atrás do gate da pesquisa (8.2) e da
sessão magic link (8.1), e **mede** o acesso à live para alimentar lead score/streak em stories
seguintes. Modelo **próprio** (tabela nova `lives`), separado do `content_items` da 8.14 — a live tem
ciclo de vida próprio (janela ao vivo + gravação).

Superfície, espelhando o padrão da 8.14 (conteúdo):
1. **Tabela nova `lives`** (pg-mem-safe: id texto, sem FK/GENERATED; datas/int; estado derivado em TS).
2. **`lib/lives.ts`** (framework-agnostic): `Live`/`LiveInput`, `listLives`/`getLive`/`createLive`, e as
   regras puras `liveState(live, now)`, `isWatchable(state)`, `watchResource(live, state)`.
3. **Rotas** espelhando conteúdo: `GET /api/evento/lives` (agenda por lead: gate × estado; nunca vaza
   url), `POST /api/evento/lives/[id]/abrir` (revalida gate + estado assistível, **mede `live.opened`**,
   devolve o embed), `POST /api/events/[eventId]/lives` (provisionamento admin `X-Api-Key`).
4. **Novo tipo de engajamento `live.opened`** na taxonomia (`lib/engagement.ts` + `CONTRIBUTING §3`),
   no mesmo padrão de como 8.12 (`hub.viewed`) e 8.14 (`content.opened`) adicionaram os seus — sinal
   distinto de "abriu conteúdo", útil para score/streak diferenciarem presença em live.
5. **UI** mobile-first: página `app/evento/lives/page.tsx` + `components/LivesAquecimento.tsx` (lista com
   estado/CTA por live), reusando o estilo do hub de conteúdo.

Mock = lives **seedadas** com `stream_url`/`recording_url` placeholder (podem estar vazios); a troca pelo
streaming real é evolução futura **na mesma tabela** (FR-013), sem novo modelo.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, `pg`; reúso de `lib/` (`db`, `leads`, `events`, `engagement`,
`auth/session`). **Sem novas dependências externas.**

**Storage**: PostgreSQL (Neon) via `query()`; `pg-mem` nos testes. **Tabela nova `lives`** (pg-mem-safe:
id texto via `newId('live')`, sem FK/GENERATED; `starts_at timestamptz`, `duration_min int`,
`stream_url`/`recording_url text`, `position int`). Estado **derivado em TS**, não persistido.

**Testing**: `vitest` + `pg-mem`. Regra de estado testada como função pura (`lib/lives`) e via os Route
Handlers (lista/abrir/provisionar) invocados direto; `emit` mockado/consultado para asserir medição.
Auth de lead por cookie `dc_session`; borda admin por `X-Api-Key`.

**Target Platform**: Web mobile-first (PWA), Next single-origin. Nova seção/página de lives integrada ao
hub pré-evento (8.12); embed dentro da plataforma (Const. III).

**Performance Goals**: derivação de estado é aritmética por requisição; sem I/O extra além de buscar lead
+ lives. Resposta praticamente instantânea; estado muda ao cruzar início/fim da janela.

**Constraints**: estado calculado **no momento da leitura** (sem congelar); gate (8.2) + sessão (8.1)
**antes** de assistir; degradação segura para dado ruim (sem data ⇒ "em breve"; sem duração ⇒ default;
sem gravação após a janela ⇒ "encerrada"); camada agnostic e pg-mem-safe; `emit` best-effort.

**Scale/Scope**: 1 evento ativo, poucas lives, milhares de leads. **1 tabela + `lib/lives.ts` + 3 Route
Handlers + 1 componente/página + 1 tipo de engajamento + testes + docs.**

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Nova seção de lives desenhada mobile-first (375–430px, ≥44px, sem shift) | ✅ atende |
| **II. Magic Link (sem senha)** | Acesso só com sessão válida; nada de senha/cadastro | ✅ atende |
| **III. Ambiente Único** | Transmissão/gravação por **embed dentro** da plataforma; nada redireciona pra fora | ✅ atende |
| **IV. Tudo é Mensurado** | Novo tipo `live.opened` no contrato de eventos (padrão 8.12/8.14); features emitem, score/streak consomem | ✅ atende |
| **V. Test-First / TDD** | Teste (vitest+pg-mem) antes; estado puro + rotas asseridas; medição verificada | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | Tabela `lives` id texto/sem FK/GENERATED; regra em `lib/lives`; `query()`; cookie/`X-Api-Key`; best-effort | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.17-lives-aquecimento-mock/` | ✅ atende |

**Sem violações.** Nenhuma entrada no Complexity Tracking. (A adição de `live.opened` é expansão do
contrato de eventos, não violação — é o acoplamento sancionado pela Const. IV.)

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.17-lives-aquecimento-mock/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/lives-aquecimento.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
lib/
├── db.ts          # ESTENDER — CREATE TABLE lives (SCHEMA); pg-mem-safe
├── engagement.ts  # ESTENDER — adicionar 'live.opened' ao EngagementType
└── lives.ts       # NOVO — Live/LiveInput; listLives/getLive/createLive; liveState/isWatchable/watchResource

app/api/evento/lives/route.ts             # NOVO — agenda por lead (gate × estado); nunca vaza url
app/api/evento/lives/[id]/abrir/route.ts  # NOVO — revalida gate + estado assistível; emite live.opened; devolve embed
app/api/events/[eventId]/lives/route.ts   # NOVO — provisionamento admin (X-Api-Key)

app/evento/lives/page.tsx                 # NOVO — página da seção
components/LivesAquecimento.tsx           # NOVO — lista mobile-first com estado + CTA por live

tests/
├── lives.state.test.ts        # NOVO — liveState/isWatchable/watchResource (janelas, dado ruim, default de duração)
├── evento.lives.route.test.ts # NOVO — agenda (estados por horário) + abrir (assistível ⇒ 200 + live.opened; não ⇒ 403 sem emit; gate; 401)
└── lives.ingest.test.ts       # NOVO — provisionamento X-Api-Key (201; 401 sem/errada; 400 sem título)
```

**Provisionamento** (FR-009, sem admin UI — admin é 8.9): lives seedadas/curadas via
`POST /api/events/[eventId]/lives` (`X-Api-Key`) ou SQL, padrão 8.4/8.14/8.15. Mock = placeholder de
`stream_url`/`recording_url`. Documentado no `quickstart.md`.

**Structure Decision**: **Next.js App Router em TypeScript**, single-origin. **Modelo próprio** (`lives`)
por decisão de produto (ciclo de vida distinto do conteúdo dia-1), com **estado derivado em TS** e
**medição via novo tipo `live.opened`**. Espelha deliberadamente o padrão de rotas/hub da 8.14 para
reúso de convenções (gate, sessão, `abrir` que revalida e revela o recurso, provisionamento admin).

## Complexity Tracking

> Sem violações constitucionais — seção vazia.
