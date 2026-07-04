# Quickstart — Nivelamento com liberação progressiva por lead (8.16)

Guia de validação ponta a ponta. Reúsa hub/rotas da 8.14; a diferença é **quais aulas** liberam por lead.

## Pré-requisitos

- Node + deps instaladas; `npm test` verde antes de começar (TDD — Const. V).
- Reúso: `lib/content.ts`, `lib/leads.ts` (`createdAt`), `lib/engagement.ts` (`hasCompletedSurvey`,
  `emit`, `content.opened`), rotas `app/api/evento/conteudo/*`.

## 1. Testes (TDD — escrever e ver FALHAR primeiro)

```bash
npx vitest run tests/content.release-for-lead.test.ts tests/evento.conteudo.progressivo.test.ts
```

Casos que devem passar ao fim:

- **Regra pura** (`content.release-for-lead.test.ts`):
  - `kind='lesson'`, offset 0, entrada no passado ⇒ liberado.
  - offset 2, entrada há 1 dia ⇒ **não** liberado; entrada há 3 dias ⇒ liberado.
  - offset ausente/negativo/`NaN` ⇒ tratado como 0.
  - `kind='doc'` ⇒ ignora offset, cai em `isReleased` (calendário).
  - `leadEntryDate` inválida ⇒ tratada como "agora" (só offset 0 libera).
  - `releaseForLeadAt` = `entrada + offset*dia` para lesson; `= releaseAt` para não-lesson.

- **Rotas** (`evento.conteudo.progressivo.test.ts`, mock de `emit`):
  - dois leads (entrada "hoje" e "há 5 dias") ⇒ `GET` devolve `available` **diferente** para a mesma aula.
  - aula futura p/ o lead ⇒ `available:false` e `releaseForLeadAt` = data por lead.
  - `POST .../abrir` em aula não liberada p/ o lead ⇒ `403 not_released`, **sem** `content.opened`.
  - `POST .../abrir` em aula liberada ⇒ `200 {resource}` **e** `content.opened` emitido.
  - gate não satisfeito ⇒ `403 gated` antes de qualquer liberação.

## 2. Provisionar cadência (config/DB, sem admin UI)

Via rota admin (`X-Api-Key`) — cadência de ~2-3 dias:

```bash
curl -sX POST "$BASE/api/events/$EVENT_ID/conteudo" -H "X-Api-Key: $KEY" \
  -H 'content-type: application/json' \
  -d '{"kind":"lesson","title":"Aula 1","resource":"<embed>","releaseOffsetDays":0}'
curl -sX POST "$BASE/api/events/$EVENT_ID/conteudo" -H "X-Api-Key: $KEY" \
  -H 'content-type: application/json' \
  -d '{"kind":"lesson","title":"Aula 2","resource":"<embed>","releaseOffsetDays":2}'
curl -sX POST "$BASE/api/events/$EVENT_ID/conteudo" -H "X-Api-Key: $KEY" \
  -H 'content-type: application/json' \
  -d '{"kind":"lesson","title":"Aula 3","resource":"<embed>","releaseOffsetDays":5}'
```

Ou SQL: `UPDATE content_items SET release_offset_days = 2 WHERE id = '<lesson>'`.

## 3. Validar o comportamento por lead

- Lead recém-entrado (`createdAt` ≈ agora), gate satisfeito ⇒ vê **Aula 1** liberada; **Aula 2/3** como
  "em breve" com data prevista (`entrada + 2d` / `entrada + 5d`).
- Lead com `createdAt` de 3 dias atrás ⇒ vê **Aula 1 e 2** liberadas; **Aula 3** ainda "em breve".
- Nenhuma aula libera antes do gate da pesquisa, independentemente do tempo de entrada.

## 4. Gate final

```bash
npm test && npx tsc --noEmit
```

Ambos verdes/limpos (Const. V). Sem regressão na 8.14 (docs/CodeQuest seguem por calendário).
