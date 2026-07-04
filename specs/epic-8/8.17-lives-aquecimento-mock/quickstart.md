# Quickstart — Lives de aquecimento (mockadas) (8.17)

Guia de validação ponta a ponta. Espelha o padrão de conteúdo da 8.14; a diferença é o **estado por
horário** e a medição **`live.opened`**.

## Pré-requisitos

- Node + deps instaladas; `npm test` verde antes de começar (TDD — Const. V).
- Reúso: `lib/engagement.ts` (`hasCompletedSurvey`, `emit`), `lib/auth/session.ts`, `lib/leads.ts`.

## 1. Testes (TDD — escrever e ver FALHAR primeiro)

```bash
npx vitest run tests/lives.state.test.ts tests/evento.lives.route.test.ts tests/lives.ingest.test.ts
```

Casos que devem passar ao fim:

- **Regra pura** (`lives.state.test.ts`):
  - início no futuro ⇒ `scheduled`; agora dentro de [início, início+dur] ⇒ `live`; após a janela com
    gravação ⇒ `recording`; após a janela sem gravação ⇒ `ended`.
  - `durationMin` ausente/inválido ⇒ usa default (90); `startsAt` inválido ⇒ `scheduled`.
  - `isWatchable`/`watchResource` coerentes com o estado (retorna stream no `live`, gravação no
    `recording`, `null` nos demais).

- **Rotas** (`evento.lives.route.test.ts`):
  - `GET` reflete os quatro estados por horário e **nunca** vaza `streamUrl`/`recordingUrl`.
  - `POST .../abrir` em live assistível ⇒ `200 {resource}` **e** 1 `live.opened` (`{liveId, state}`).
  - `POST .../abrir` em live `scheduled`/`ended` ⇒ `403 not_watchable`, **sem** `live.opened`.
  - gate não satisfeito ⇒ `403 gated`; sem sessão ⇒ `401`.

- **Provisionamento** (`lives.ingest.test.ts`):
  - `POST /api/events/[eventId]/lives` sem/`X-Api-Key` errada ⇒ `401`; sem `title` ⇒ `400`; ok ⇒ `201`.

## 2. Seedar a agenda mock (config/DB, sem admin UI)

Via rota admin (`X-Api-Key`) — três lives cobrindo os estados:

```bash
# ao vivo agora (janela contém agora)
curl -sX POST "$BASE/api/events/$EVENT_ID/lives" -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"title":"Live 1 (ao vivo)","startsAt":"'"$(date -u -d '-10 min' +%FT%TZ)"'","durationMin":90,"streamUrl":"<embed>"}'
# em breve (futuro)
curl -sX POST "$BASE/api/events/$EVENT_ID/lives" -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"title":"Live 2 (em breve)","startsAt":"'"$(date -u -d '+2 day' +%FT%TZ)"'","durationMin":90}'
# gravação disponível (passado + gravação)
curl -sX POST "$BASE/api/events/$EVENT_ID/lives" -H "X-Api-Key: $KEY" -H 'content-type: application/json' \
  -d '{"title":"Live 3 (gravação)","startsAt":"'"$(date -u -d '-2 day' +%FT%TZ)"'","durationMin":90,"recordingUrl":"<embed>"}'
```

Mock = `streamUrl`/`recordingUrl` placeholder; troca pelo real depois na mesma tabela.

## 3. Validar no hub

- Lead com gate satisfeito vê as 3 lives com estados **ao vivo / em breve (com data) / gravação**.
- Assistir à "ao vivo" ou "gravação" abre o embed dentro da plataforma e **gera `live.opened`**.
- Assistir à "em breve" é negado (403) e **não** gera evento.
- Sem passar o gate, a seção fica bloqueada.

## 4. Gate final

```bash
npm test && npx tsc --noEmit
```

Ambos verdes/limpos (Const. V). `CONTRIBUTING §3` atualizado com `live.opened`.
