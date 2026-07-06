# Implementation Plan: Streak e badges de engajamento (gamificação)

**Branch**: `feat/8.19-streak-badges` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.19-streak-badges/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0.

## Summary

Adiciona **streak** (dias consecutivos ativos) e **badges** (conquistas por regras fixas) **derivados**
dos `engagement_events` + lead score (8.18), **sem persistência** (Const. VI). O **participante** vê o
próprio streak/badges no hub (sessão `dc_session`, mobile-first) para se motivar; o **time/automação**
consome por `X-Api-Key`. Só **consome** o contrato de eventos (Const. IV); **nenhum** tipo novo, nenhuma
emissão.

Superfície (fina, sem tabela nova):
1. **`lib/gamification.ts`** (framework-agnostic): `dayKey` (bucket de dia no fuso do evento),
   `computeStreak(dayKeys, today)` → `{ current, longest }`, catálogo `BADGES` (regras fixas) e
   `evaluateBadges(ctx)`, mais `getLeadGamification(eventId, leadId, now)` → `{ streak, badges }` (lê
   `engagement_events` + reúsa `getLeadScore`).
2. **Rotas**:
   - `GET /api/evento/gamificacao` (participante, `dc_session`) → streak+badges do próprio lead.
   - `GET /api/events/[eventId]/leads/[leadId]/gamification` (admin, `X-Api-Key`) → consumo.
3. **UI** mobile-first: `app/evento/gamificacao/page.tsx` + `components/GamificacaoPainel.tsx` (streak em
   destaque + grade de badges conquistados/bloqueados com critério), reusando o estilo do hub.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, `pg`; reúso de `lib/` (`db`, `engagement`, `score`, `leads`, `events`,
`auth/session`). **Sem novas dependências externas.**

**Storage**: PostgreSQL (Neon) via `query()`; `pg-mem` nos testes. **Sem tabela nova, sem coluna nova.**
Streak/badges **derivados** de `engagement_events` (+ lead score). Bucket de dia calculado **em TS** por
offset fixo (São Paulo = UTC−3, sem DST) — nada de funções de data no SQL (pg-mem-safe).

**Testing**: `vitest` + `pg-mem`. Regras puras (`dayKey`, `computeStreak`, `evaluateBadges`) e
`getLeadGamification` (com eventos seedados via `emit`) testadas; Route Handlers (participante + admin)
invocados direto; `dc_session` e `X-Api-Key` nas bordas.

**Target Platform**: Web mobile-first (PWA), Next single-origin. Painel do participante integrado ao hub
(8.12); embed dentro da plataforma.

**Performance Goals**: 1–2 consultas por leitura (atividade do lead + score). Escala do piloto (milhares
de leads) sem degradação perceptível; streak/badges recalculados na leitura.

**Constraints**: derivado na leitura (sem persistir); **determinístico**; dia por calendário no fuso do
evento; tolerância "hoje vs. ontem" no streak; degradação segura (lead sem eventos ⇒ streak 0, 0 badges);
só consome eventos + score; `dc_session` (participante) / `X-Api-Key` (admin); camada agnostic e
pg-mem-safe.

**Scale/Scope**: 1 evento ativo, milhares de leads. **1 lib + 2 Route Handlers + 1 componente/página +
testes + docs.** Sem tabela, sem emissão.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Painel do participante desenhado mobile-first (375–430px, ≥44px, sem shift) | ✅ atende |
| **II. Magic Link (sem senha)** | Participante vê via sessão `dc_session`; sem senha/cadastro | ✅ atende |
| **III. Ambiente Único** | Painel vive no hub; nada redireciona pra fora | ✅ atende |
| **IV. Tudo é Mensurado** | **Consome** `engagement_events` + score (acoplamento permitido); **não** emite nem cria tipo | ✅ atende (reforça) |
| **V. Test-First / TDD** | Teste (vitest+pg-mem) antes; regras puras + leitura + rotas | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | Streak/badges derivados em TS; bucket de dia por offset em TS; `query()`; sem FK/GENERATED; `dc_session`/`X-Api-Key` | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.19-streak-badges/` | ✅ atende |

**Sem violações.** Nenhuma entrada no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.19-streak-badges/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/streak-badges.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
lib/
└── gamification.ts   # NOVO — DAY_TZ_OFFSET_MIN; dayKey; computeStreak; BADGES + evaluateBadges;
                       #        getLeadGamification(eventId, leadId, now) → { streak, badges }

app/api/evento/gamificacao/route.ts                          # NOVO — GET participante (dc_session): streak+badges próprios
app/api/events/[eventId]/leads/[leadId]/gamification/route.ts # NOVO — GET admin (X-Api-Key): consumo

app/evento/gamificacao/page.tsx        # NOVO — página do painel
components/GamificacaoPainel.tsx        # NOVO — streak em destaque + grade de badges (conquistado/bloqueado)

tests/
├── gamification.streak.test.ts   # NOVO — dayKey (fuso), computeStreak (consecutivos, quebra, tolerância hoje/ontem, mesmo-dia = 1)
├── gamification.badges.test.ts    # NOVO — evaluateBadges: catálogo, conquistado/bloqueado, por score (via 8.18); determinístico; desconhecido não quebra
└── gamification.route.test.ts     # NOVO — GET participante (dc_session; 401 sem sessão) e GET admin (X-Api-Key; 401/404); lead sem eventos ⇒ streak 0, 0 badges
```

**Catálogo de badges** (versionado em `lib/gamification.ts`, valores no research). **Consumo** admin por
`X-Api-Key`; participante por `dc_session`. Sem admin UI (8.9).

**Structure Decision**: **Next.js App Router em TS**, single-origin. Story de **consumo + exibição**:
uma lib de gamificação (streak + badges, tudo derivado em TS) e duas rotas (participante/admin), mais um
painel mobile-first no hub. Reúsa `lib/score.ts` (8.18) para badges por score e o contrato de eventos
como única fonte. Nenhuma tabela, emissão ou tipo novo.

## Complexity Tracking

> Sem violações constitucionais — seção vazia.
