# Implementation Plan: Nivelamento com liberação progressiva por lead (drip por tempo de entrada)

**Branch**: `feat/8.16-nivelamento-progressivo` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.16-nivelamento-progressivo/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0.

## Summary

Muda a liberação das **aulas de nivelamento** (`content_items` `kind='lesson'`, portadas na 8.14) de
**drip por data de calendário** (`release_at` global) para **drip por-lead relativo à data de entrada**:
uma aula abre quando `now >= lead.createdAt + offset_dias_da_aula`. Cada lead começa da aula 1 e destrava
as seguintes a cada 2-3 dias **a partir da própria entrada** — sem exigir concluir a anterior.

**Net-new de código** é pequeno e concentrado em `lib/content.ts` + as duas rotas de conteúdo do lead:
1. **Uma coluna** em `content_items`: `release_offset_days int` (pg-mem-safe; default em TS).
2. **Um helper** `isLessonReleasedForLead(item, leadEntryDate, now)` e um seletor de precedência
   `isItemReleasedForLead(item, leadEntryDate, now)` = para `kind='lesson'` usa o offset por-lead; para
   os demais kinds mantém `isReleased` (calendário da 8.14). Mais um cálculo de **data prevista por lead**
   (`entrada + offset`) para o rótulo "em breve".
3. **Fiação nas rotas** `GET /api/evento/conteudo` (lista: passar `lead.createdAt`, calcular `available`
   e `releaseForLeadAt` por aula) e `POST /api/evento/conteudo/[id]/abrir` (revalidar liberação por-lead
   no servidor antes de medir `content.opened`).

Medição do acesso é **reúso** de `content.opened` (8.14) — sem novo tipo na taxonomia FROZEN. Score
(8.17) e streak (8.18) apenas **consumirão** esse sinal, fora do escopo. Provisionamento do offset por
aula é **config/DB** (sem admin UI), via a rota admin existente `POST /api/events/[eventId]/conteudo`
(`X-Api-Key`).

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, `pg`; reúso de `lib/` (`content`, `leads`, `events`, `engagement`,
`auth/session`). **Sem novas dependências externas.**

**Storage**: PostgreSQL (Neon) via `query()`; `pg-mem` nos testes. **Sem tabela nova.** **Uma coluna
nova** em `content_items`: `release_offset_days int` (pg-mem-safe: int, sem FK/GENERATED, default em TS).

**Testing**: `vitest` + `pg-mem`. Regra de liberação testada como função pura (`lib/content`) e via os
Route Handlers de lista/abrir invocados diretamente; `emit` mockado para asserir "mediu / não mediu".
Auth de lead por cookie `dc_session`; borda admin por `X-Api-Key`.

**Target Platform**: Web mobile-first (PWA), Next single-origin. Reúsa a superfície de hub de conteúdo
existente (`app/evento/conteudo/page.tsx`); **sem tela nova** — só muda quais aulas aparecem
liberadas/"em breve" e a data prevista por lead.

**Performance Goals**: cálculo de liberação é aritmética em memória por requisição; sem custo de I/O
extra além do já feito (buscar lead + itens). Resposta praticamente instantânea.

**Constraints**: liberação calculada **no momento da leitura** (sem estado congelado); gate da pesquisa
(8.2) e sessão magic link (8.1) **antes** da liberação; degradação segura para dado ruim (entrada
ausente/inválida ⇒ trata como "agora"; offset ausente/inválido ⇒ default); camada agnostic e pg-mem-safe;
efeitos best-effort.

**Scale/Scope**: 1 evento ativo, milhares de leads, poucas aulas. **1 coluna + helper(s) em
`lib/content` + 2 Route Handlers estendidos + testes + docs.** Nenhuma tela nova.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Sem tela nova; reúsa hub 8.14 (já mobile-first); rótulo "em breve" com data por lead | ✅ atende (N/A de UI nova) |
| **II. Magic Link (sem senha)** | Liberação só para lead com sessão válida; nada de senha/cadastro | ✅ atende |
| **III. Ambiente Único** | Aula continua sendo reproduzida dentro da plataforma (embed); nada redireciona pra fora | ✅ atende |
| **IV. Tudo é Mensurado** | Reúsa `content.opened` (sem novo tipo FROZEN); deixa o sinal pronto p/ score/streak | ✅ atende |
| **V. Test-First / TDD** | Teste (vitest+pg-mem) antes; regra pura + rotas asseridas por mock de `emit` | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | Coluna `release_offset_days int` sem FK/GENERATED; regra em `lib/content`; `query()`; cookie/`X-Api-Key`; best-effort | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.16-nivelamento-progressivo/` | ✅ atende |

**Sem violações.** Nenhuma entrada no Complexity Tracking. (A exceção do CodeQuest "abre fora" é herança
registrada na 8.14 e não é tocada por esta story.)

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.16-nivelamento-progressivo/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/nivelamento-progressivo.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
lib/
├── db.ts        # ESTENDER — coluna content_items.release_offset_days int (schema + ALTER idempotente)
└── content.ts   # ESTENDER — mapear releaseOffsetDays; helpers isLessonReleasedForLead /
                 #   isItemReleasedForLead / releaseForLeadAt; ContentInput aceita releaseOffsetDays

app/api/evento/conteudo/route.ts          # ESTENDER — lista: passar lead.createdAt; available e
                                          #   releaseForLeadAt por aula usando o modo por-lead
app/api/evento/conteudo/[id]/abrir/route.ts  # ESTENDER — revalidar liberação por-lead antes de emit
app/api/events/[eventId]/conteudo/route.ts   # ESTENDER — aceitar releaseOffsetDays no provisionamento (X-Api-Key)

tests/
├── content.release-for-lead.test.ts        # NOVO — regra pura: offset+entrada; default; kind!='lesson' cai no calendário; dado ruim
└── evento.conteudo.progressivo.test.ts      # NOVO — rotas lista/abrir por-lead: 2 leads em datas diferentes;
                                             #   "em breve" com data por lead; abrir aula não liberada ⇒ 403 sem content.opened
```

**Provisionamento** (FR-011, sem admin UI — admin é 8.9): offset por aula setado via a rota admin
existente `POST /api/events/[eventId]/conteudo` (`X-Api-Key`) ou por SQL, no padrão 8.4/8.14/8.15.
Documentado no `quickstart.md`.

**Structure Decision**: **Next.js App Router em TypeScript**, single-origin. Reúso máximo da 8.14
(modelo `content_items`, hub, `content.opened`, rota admin). A story adiciona **um discriminador de
liberação por-lead** (offset em dias × data de entrada) que **prevalece para aulas** e convive com o
drip por calendário (docs/CodeQuest). Nenhuma tela nova; a curadoria do ritmo é config/DB.

## Complexity Tracking

> Sem violações constitucionais — seção vazia.
