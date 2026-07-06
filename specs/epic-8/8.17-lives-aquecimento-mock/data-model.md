# Phase 1 — Data Model: Lives de aquecimento (mockadas)

**Tabela nova `lives`.** Reúso de `leads`/`engagement_events`. Estado **derivado em TS**, não persistido.

## Entidades

### `lives` (NOVA)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | `text` PK | `newId('live')` — pg-mem-safe (nunca UUID) |
| `event_id` | `text` NOT NULL | evento dono (sem FK — pg-mem-safe) |
| `title` | `text` NOT NULL | validado em TS (`LiveValidationError`) |
| `description` | `text` NULL | |
| `starts_at` | `timestamptz` NULL | início da live. Ausente/inválido ⇒ estado `'scheduled'` seguro |
| `duration_min` | `int` NULL | duração; ausente/inválido ⇒ `DEFAULT_DURATION_MIN` (90) no cálculo |
| `stream_url` | `text` NULL | embed da **transmissão** (assistir ao vivo). Mock ⇒ placeholder/vazio |
| `recording_url` | `text` NULL | embed da **gravação** (assistir depois). Mock ⇒ placeholder/vazio |
| `position` | `int` NULL | ordenação (nulls por último) |
| `created_at` | `timestamptz` NULL | |

- **pg-mem-safe**: id texto, **sem FK**, **sem GENERATED**, **sem índice parcial**; estado derivado em TS.
- **Camada agnostic**: mapear snake↔camel na borda (`LiveRow` → `Live`). `SELECT` explícito com aliases.
- **Índices** (opcionais, não-parciais): `idx_lives_event (event_id)`.

### `engagement_events` (REÚSO + 1 tipo novo)

- Adicionar **`'live.opened'`** ao `EngagementType` (`lib/engagement.ts`) e ao `CONTRIBUTING §3`.
- Emitido no `abrir` de live assistível, `data = { liveId, state }` (`state ∈ 'live'|'recording'`).
- Insumo para **lead score** e **streak/badges** (stories seguintes). Emite=8.17; consome=score/streak.

### `leads` (REÚSO)

- Sessão válida (8.1) + gate `survey.completed` (8.2 via `hasCompletedSurvey`). Sem alteração de schema.

## Regras derivadas (em TypeScript — `lib/lives.ts`)

Puras, testáveis sem DB:

```
DEFAULT_DURATION_MIN = 90
type LiveState = 'scheduled' | 'live' | 'recording' | 'ended'

liveState(live, now):
    start = validDate(live.startsAt)
    if !start: return 'scheduled'                       // dado ruim ⇒ seguro
    end = start + (sanitizeDuration(live.durationMin)) * 60_000
    if now < start: return 'scheduled'
    if now <= end:  return 'live'
    return live.recordingUrl ? 'recording' : 'ended'

sanitizeDuration(n) = Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DURATION_MIN

isWatchable(state) = state === 'live' || state === 'recording'

watchResource(live, state):
    if state === 'live':      return live.streamUrl
    if state === 'recording': return live.recordingUrl
    return null
```

## Validação

- `createLive`: `title` obrigatório (trim) ⇒ senão `LiveValidationError` (400 na borda). `starts_at`
  aceita ISO; `duration_min` inteiro ≥ 0 (saneado no cálculo). `stream_url`/`recording_url` opcionais
  (mock).

## Transições de estado (derivadas do tempo)

```
[now < início] scheduled  --início--> [janela] live  --fim--> recording (se há gravação)
                                                            \-> ended     (se não há gravação)
```

Sem estado persistido nem job: recalculado a cada leitura (FR-003).
