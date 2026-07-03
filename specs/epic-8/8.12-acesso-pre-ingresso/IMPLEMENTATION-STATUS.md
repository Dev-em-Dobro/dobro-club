# Handoff — Implementação da Story 8.12 (acesso pré-ingresso)

> Branch: `feat/8.12-acesso-pre-ingresso` (empilhada na `feat/next-ingresso-magic-link`).
> "O que falta" = tarefas sem `[X]` em [tasks.md](./tasks.md). Rodar `npm test` para reconfirmar.

**Status**: ✅ **COMPLETO** — 20/20 tarefas. `npm test` 23 arquivos / 77 testes verdes. `tsc --noEmit` limpo.

## Entregue

**Foundational**
- `lib/db.ts` — coluna `week_starts_at timestamptz` (schema + `ALTER TABLE ... IF NOT EXISTS`).
- `lib/events.ts` — `weekStartsAt` em `EventRow` + `SELECT_EVENT`.
- `lib/ingresso.ts` — `ingressoWindowOpensAt` + `ingressoPhase` (puros). `tests/ingresso.phase.test.ts` (7).
- `tests/helpers/testdb.ts` — `seedEvent` aceita `weekStartsAt`.

**US1 (MVP) — acesso + credencial provisória + hub**
- `lib/engagement.ts` — `'hub.viewed'` na taxonomia FROZEN.
- `app/api/evento/route.ts` — `GET` (dc_session) → `{ lead, phase, ticket, windowOpensAt, surveyAnswered }` + emite `hub.viewed`.
- `components/EventoHub.tsx` + `app/evento/page.tsx` — hub mobile-first.
- `app/legacy-shell.css` — estilos `.ticket-figure/.ticket-image/.ticket-badge/.hub-gate`.
- `tests/evento.route.test.ts` (7).

**US2 — convergência**
- `phase='oficial'` deriva do tempo (sem migração); `EventoHub` troca selo/estado.

**US3 — gate da pesquisa**
- `lib/engagement.ts` — `hasCompletedSurvey(leadId)` lê `engagement_events(survey.completed)`.
- Rota expõe `surveyAnswered`; `EventoHub` bloqueia conteúdo até responder. `tests/survey-gate.test.ts` (4).

**Polish**
- `CONTRIBUTING.md §3` — `hub.viewed` (emite=8.12) registrado.

## Ainda recomendado (não bloqueia)
- **QA visual em dispositivo/navegador** do `app/evento` a 375–430px — feito estruturalmente
  (reúso do layout `ticket-screen`, alvos ≥44px), mas não houve render real neste ambiente.
- **CTA da pesquisa**: `EventoHub` aponta para `/e/<slug>` como destino seguro; ajustar para a rota
  real da pesquisa quando a 8.2 for migrada para Next.
- **`week_starts_at` do evento**: definir a data no evento de produção para a janela T-3 funcionar
  (sem data ⇒ sempre `provisoria`, sem contagem).
