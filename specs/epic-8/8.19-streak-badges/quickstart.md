# Quickstart — Streak e badges (8.19)

Guia de validação ponta a ponta. Story de **consumo + exibição**: streak/badges derivados de
`engagement_events` + lead score.

## Pré-requisitos

- Node + deps; `npm test` verde antes (TDD — Const. V).
- Reúso: `lib/engagement.ts` (`emit`), `lib/score.ts` (`getLeadScore`), `lib/auth/session.ts`,
  `lib/leads.ts`, `lib/events.ts`.

## 1. Testes (TDD — escrever e ver FALHAR primeiro)

```bash
npx vitest run tests/gamification.streak.test.ts tests/gamification.badges.test.ts tests/gamification.route.test.ts
```

Casos que devem passar ao fim:

- **Streak** (`gamification.streak.test.ts`):
  - `dayKey` agrupa por dia no fuso (UTC−3): 23h de um dia e 00h05 do outro ⇒ dias distintos.
  - `computeStreak`: 3 dias consecutivos terminando hoje ⇒ `current:3`; gap de 1 dia zera; vários
    eventos no mesmo dia ⇒ 1; tolerância: último ativo = ontem e hoje vazio ⇒ `current` mantém.
  - `longest` = maior sequência histórica.

- **Badges** (`gamification.badges.test.ts`):
  - `evaluateBadges`: `primeira-live` earned com `live.opened>=1`; `explorador` bloqueado até
    `content.opened>=5`; `streak-3`/`streak-7` por `longest`; `engajado` por score>=20.
  - determinístico; badge com `test` que erra ⇒ `earned:false` (não derruba os demais).

- **Rotas** (`gamification.route.test.ts`, pg-mem + `emit`):
  - `GET /api/evento/gamificacao`: `401` sem sessão; `200 { streak, badges }` do próprio lead.
  - `GET /api/events/[eventId]/leads/[leadId]/gamification`: `401` sem/`X-Api-Key` errada; `404` evento
    inexistente; `200` com o corpo.
  - lead sem eventos ⇒ `streak {0,0}` e nenhum badge earned.

## 2. Exercitar manualmente (opcional)

```bash
# participante (precisa do cookie dc_session)
curl -s "$BASE/api/evento/gamificacao" -H "cookie: dc_session=$SESSION"
# consumo admin
curl -s "$BASE/api/events/$EVENT_ID/leads/$LEAD_ID/gamification" -H "X-Api-Key: $KEY"
```

## 3. Validar o painel no hub

- Lead com atividade em dias seguidos ⇒ vê o streak em destaque e os badges conquistados; badges
  bloqueados mostram o critério (incentivo).
- Sem passar pela sessão, o painel não abre.

## 4. Ajustar catálogo/limiares

Editar `BADGES` / `DAY_TZ_OFFSET_MIN` em `lib/gamification.ts` e reexecutar os testes; muda na próxima
leitura (derivado, sem migração).

## 5. Gate final

```bash
npm test && npx tsc --noEmit
```

Ambos verdes/limpos (Const. V). Sem tabela nova; sem novo tipo de evento.
