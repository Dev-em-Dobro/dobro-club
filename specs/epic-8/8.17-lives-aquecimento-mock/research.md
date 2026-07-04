# Phase 0 — Research: Lives de aquecimento (mockadas)

Decisões de produto já travadas na spec (Clarifications 2026-07-03): modelo próprio + agenda/estados.
Aqui consolidam-se as decisões **técnicas** de reúso, medição e bordas.

## D1 — Modelo próprio `lives` (pg-mem-safe), estado derivado

- **Decisão**: tabela nova `lives` com `id text` (`newId('live')`), `event_id text`, `title`,
  `description`, `starts_at timestamptz`, `duration_min int`, `stream_url text`, `recording_url text`,
  `position int`, `created_at`. **Estado não é coluna** — é derivado em TS por `liveState(live, now)`.
- **Rationale**: a live tem ciclo de vida (janela ao vivo + gravação) que não cabe bem no
  `content_items`/`release_at`. Modelo próprio evita sobrecarregar o conteúdo dia-1 e deixa espaço para
  o streaming real depois (FR-013), sem migração. Estado derivado segue o padrão pg-mem-safe da 8.14/8.16
  (derivados em TS, sem GENERATED).
- **Alternativas**: reusar `content_items` com `kind='live'` — rejeitado na spec (Clarification): mistura
  semânticas e forçaria colunas de live no conteúdo. Persistir estado — rejeitado: fura "calculado na
  leitura" (FR-003) e exige job de transição.

## D2 — Regra de estado `liveState(live, now)`

- **Decisão** (pura, em `lib/lives.ts`):
  - `start = Date(starts_at)`; inválida/ausente ⇒ **`'scheduled'`** (seguro, sem link).
  - `end = start + (duration_min ?? DEFAULT_DURATION_MIN) * 60_000`.
  - `now < start` ⇒ `'scheduled'`; `start ≤ now ≤ end` ⇒ `'live'`; `now > end` ⇒ `recording_url` ?
    `'recording'` : `'ended'`.
  - `isWatchable(state)` = `state === 'live' || state === 'recording'`.
  - `watchResource(live, state)` = `'live'` ⇒ `stream_url`; `'recording'` ⇒ `recording_url`; senão `null`.
- **Rationale**: um único ponto puro/testável decide tudo (estado, se assiste, qual url) — as rotas viram
  fiação, como `isReleased`/`isItemReleasedForLead` na 8.14/8.16.
- **Alternativas**: espalhar comparações nas rotas — duplicação, escapa do teste unitário; rejeitado.

## D3 — `DEFAULT_DURATION_MIN`

- **Decisão**: **90 min** quando `duration_min` ausente/inválido.
- **Rationale**: duração típica de live de aquecimento; fecha a janela do "ao vivo" sem exigir config.
  Saneado em TS (não confia no DDL). Ajustável se produto pedir.
- **Alternativas**: sem janela (ao vivo "infinito" até haver gravação) — confunde estado; rejeitado.

## D4 — Medição: novo tipo `live.opened`

- **Decisão**: adicionar `'live.opened'` ao `EngagementType` (`lib/engagement.ts`) e ao contrato em
  `CONTRIBUTING §3`. Emitido no `POST .../abrir` **após** gate + estado assistível, com
  `{ liveId, state }` (state = `'live'`|`'recording'`).
- **Rationale**: é o padrão já usado — 8.12 adicionou `hub.viewed`, 8.14 `content.opened`. Presença em
  live é sinal **distinto** de abrir conteúdo; lead score/streak vão querer diferenciar (ex.: peso maior
  para "esteve ao vivo"). O `state` no payload permite distinguir ao vivo × gravação sem novo tipo.
- **Alternativas**: reusar `content.opened` — perde a distinção live×conteúdo e polui a métrica de
  conteúdo; rejeitado. Dois tipos (`live.live`/`live.recording`) — excesso; o `state` no payload resolve.

## D5 — Rotas espelhando a 8.14 (conteúdo)

- **Decisão**: três rotas no molde da 8.14:
  - `GET /api/evento/lives`: lista para lead/visitante; item traz `state`, `startsAt`, flags de
    assistível; **nunca** devolve `stream_url`/`recording_url` na lista (revelado só no `abrir`).
  - `POST /api/evento/lives/[id]/abrir`: sessão → lead → live → gate → `isWatchable` → `emit('live.opened')`
    → devolve `{ state, resource }` (embed dentro da plataforma, `external:false`).
  - `POST /api/events/[eventId]/lives`: admin `X-Api-Key`, cria a live.
- **Rationale**: reúsa convenções conhecidas e testadas (gate, sessão, revalidação no servidor, provisão
  admin), reduzindo superfície nova e risco.
- **Alternativas**: uma rota só com querystring de ação — menos legível, foge do padrão do projeto.

## D6 — UI: página/seção própria

- **Decisão**: `app/evento/lives/page.tsx` + `components/LivesAquecimento.tsx`, mobile-first, com rótulo
  de estado (🕒 em breve com data / 🔴 ao vivo agora / ▶️ ver gravação / ⏹ encerrada) e CTA condicional.
- **Rationale**: espelha `app/evento/conteudo` + `ConteudoDia1`; integra ao hub sem inflar o componente
  de conteúdo. Menu do participante permanece enxuto (Const. III) — lives é superfície de conteúdo.
- **Alternativas**: embutir na página de conteúdo — mistura conteúdo dia-1 com agenda de lives; rejeitado.

## D7 — Degradação segura (FR-012/SC-007)

- **Decisão**: sem lives ⇒ seção some/"em breve"; live sem `starts_at` ⇒ `'scheduled'` sem link; sem
  `duration_min` ⇒ default; sem `recording_url` após a janela ⇒ `'ended'`. Nada quebra o hub.
- **Rationale**: mock e dados parciais são esperados nesta fase; a seção nunca pode derrubar o hub.

## Riscos & mitigação

- **Risco**: fuso/borda de janela. **Mit.**: comparar por instante (`getTime()`), início e fim; formatação
  de data/hora só na UI.
- **Risco**: vazar url de transmissão na lista. **Mit.**: lista nunca inclui `stream_url`/`recording_url`
  (teste cobre) — revelado só no `abrir` autenticado/validado.
- **Risco**: taxonomia FROZEN. **Mit.**: adicionar `live.opened` seguindo o precedente 8.12/8.14 e
  registrar em `CONTRIBUTING §3` (parte das tasks).
