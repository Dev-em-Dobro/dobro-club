# Contract — Lives de aquecimento (mockadas) (8.17)

Três superfícies, espelhando o padrão de conteúdo da 8.14. Estado é sempre **derivado do horário**.

## 1. `GET /api/evento/lives` (agenda — lead ou visitante)

Auth: cookie `dc_session` (opcional; visitante vê tudo travado). **Nunca** vaza url de embed.

**Response 200**:

```jsonc
{
  "authenticated": true,
  "surveyAnswered": true,
  "lives": [
    {
      "id": "live_...",
      "title": "Live de aquecimento 1",
      "description": "…",
      "startsAt": "2026-07-05T23:00:00.000Z",
      "durationMin": 90,
      "state": "scheduled",          // scheduled | live | recording | ended (derivado)
      "watchable": false,             // isWatchable(state) && authenticated && surveyAnswered
      "hasRecording": true            // recording_url presente (sem revelar a url)
    }
  ]
}
```

Regras:
- `state` = `liveState(live, now)` (sempre calculado na leitura).
- `watchable` = `authenticated && surveyAnswered && isWatchable(state)`.
- **Nunca** inclui `streamUrl`/`recordingUrl` (revelados só no `abrir`).
- Visitante/sem sessão: `watchable:false`; a agenda/estado podem ser exibidos, mas sem assistir.
- Sem lives ⇒ `lives: []` (a UI degrada com segurança).

## 2. `POST /api/evento/lives/[id]/abrir` (assistir — lead)

Auth: cookie `dc_session` (obrigatório). Revalida tudo no servidor.

Fluxo (ordem importa):
1. Sessão válida? não ⇒ `401 {error:"unauthorized"}`.
2. Lead existe e não revogado? não ⇒ `404 {error:"not_found"}`.
3. Live existe no evento? não ⇒ `404 {error:"not_found"}`.
4. Gate da pesquisa satisfeito? não ⇒ `403 {error:"gated"}`.
5. `isWatchable(liveState(live, now))`? não ⇒ **`403 {error:"not_watchable", state}`** (em breve/encerrada).
6. Só então **`emit(eventId, leadId, 'live.opened', { liveId, state })`** e devolve:

```jsonc
{ "state": "live", "resource": "<embed da transmissão ou gravação>", "external": false }
```

Garantia (SC-002/SC-003): live não assistível ⇒ **nenhum** `live.opened`; assistível ⇒ exatamente 1.

## 3. `POST /api/events/[eventId]/lives` (provisionamento — admin)

Auth: `X-Api-Key` (401 sem/errada; 404 evento inexistente; 400 sem `title`).

**Request body**:

```jsonc
{
  "title": "Live de aquecimento 1",
  "description": "…",
  "startsAt": "2026-07-05T23:00:00.000Z",
  "durationMin": 90,
  "streamUrl": "<embed ao vivo | placeholder>",
  "recordingUrl": "<embed gravação | vazio>",
  "position": 1
}
```

**Response 201**: `{ "id": "live_..." }`

- `startsAt`/`durationMin`/urls opcionais (mock ⇒ placeholder/vazio). `durationMin` inválido ⇒ tratado
  como default no cálculo (não rejeita criação).

## Notas de conformidade

- **Const. III**: `resource` é embed **dentro** da plataforma; `external:false`.
- **Const. IV**: emite **`live.opened`** (novo tipo no contrato, padrão 8.12/8.14); score/streak consomem.
- **Const. VI**: tabela `lives` id texto/sem FK/GENERATED; regra em `lib/lives`; `query()`;
  cookie/`X-Api-Key`; `emit` best-effort.
