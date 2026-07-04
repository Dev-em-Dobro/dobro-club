# Quickstart — Lead score (8.18)

Guia de validação ponta a ponta. Story de **consumo**: deriva o score de `engagement_events`.

## Pré-requisitos

- Node + deps; `npm test` verde antes (TDD — Const. V).
- Reúso: `lib/db.ts` (`query`), `lib/engagement.ts` (`emit` p/ seedar eventos nos testes),
  `lib/events.ts` (`getEvent`/`verifyApiKey`), `lib/leads.ts`.

## 1. Testes (TDD — escrever e ver FALHAR primeiro)

```bash
npx vitest run tests/score.rule.test.ts tests/score.query.test.ts tests/score.route.test.ts
```

Casos que devem passar ao fim:

- **Regra pura** (`score.rule.test.ts`):
  - `scoreFromCounts` soma `weight×count` por tipo; `sum(points) === score`.
  - tipo sem peso ⇒ `weight:0, points:0` (não quebra).
  - determinístico (mesma entrada ⇒ mesmo resultado, independe da ordem).

- **Leitura** (`score.query.test.ts`, pg-mem + `emit` p/ seedar):
  - `getLeadScore` soma os eventos do lead; adicionar 1 evento de peso P sobe o score em P.
  - lead sem eventos / fora do evento ⇒ `{ score:0, breakdown:[] }`.
  - `listEventScores` ordena por score desc, empate por leadId asc; evento sem eventos ⇒ `[]`.
  - isolamento por evento: eventos de outro `event_id` não contam.

- **Rotas** (`score.route.test.ts`):
  - `GET .../leads/[leadId]/score` e `GET .../scores`: `401` sem/`X-Api-Key` errada; `404` evento
    inexistente; `200` com o corpo do contrato.

## 2. Exercitar manualmente (opcional)

```bash
# score de um lead
curl -s "$BASE/api/events/$EVENT_ID/leads/$LEAD_ID/score" -H "X-Api-Key: $KEY"
# ranking do evento
curl -s "$BASE/api/events/$EVENT_ID/scores" -H "X-Api-Key: $KEY"
```

Esperado: `score` = soma dos pesos dos eventos do lead; `scores` ordenado por engajamento (desc).

## 3. Ajustar pesos

Editar `WEIGHTS` em `lib/score.ts` (ex.: subir `live.opened` de 5 → 7) e reexecutar os testes; a mudança
reflete na próxima leitura (score derivado, sem migração).

## 4. Gate final

```bash
npm test && npx tsc --noEmit
```

Ambos verdes/limpos (Const. V). Sem novo tipo de evento; sem tabela nova.
