# Contract — Streak e badges (8.19)

Duas rotas GET **read-only**, duas audiências. Streak/badges **derivados** de `engagement_events` + lead
score (8.18). Nenhuma emissão.

## 1. `GET /api/evento/gamificacao` (participante — sessão)

Auth: cookie `dc_session` (obrigatório). Devolve streak+badges **do próprio** lead.

Fluxo: `verifySession` → `getLeadById` (404/401) → `getLeadGamification(lead.eventId, lead.id)`.

**Response 200**:

```jsonc
{
  "streak": { "current": 3, "longest": 5 },
  "badges": [
    { "id": "primeira-live", "name": "Primeira live", "description": "…",
      "criterion": "Assista a 1 live", "earned": true },
    { "id": "explorador", "name": "Explorador de conteúdo", "description": "…",
      "criterion": "Abra 5 conteúdos", "earned": false }
  ]
}
```

- Sem sessão válida ⇒ `401 { error: "unauthorized" }`.
- Lead sem eventos ⇒ `streak {current:0, longest:0}`, todos os badges `earned:false` (200).

## 2. `GET /api/events/[eventId]/leads/[leadId]/gamification` (admin/consumo)

Auth: `X-Api-Key`. Mesmo corpo do item 1, para um lead informado.

Fluxo: eventId válido → `getEvent` (404) → `verifyApiKey` (401) → `getLeadGamification`.

**Response 200**: `{ "streak": {...}, "badges": [...] }` (idêntico ao formato acima).

**Erros**: `401` sem/`X-Api-Key` errada; `404` evento inexistente; `400` eventId malformado.

## Catálogo de badges (versionado em `lib/gamification.ts`)

| id | critério |
|---|---|
| `primeira-live` | `live.opened >= 1` |
| `explorador` | `content.opened >= 5` |
| `streak-3` | `streak.longest >= 3` |
| `streak-7` | `streak.longest >= 7` |
| `engajado` | lead score `>= 20` (8.18) |

## Notas de conformidade

- **Const. IV**: só **consome** `engagement_events` + lead score; **não** emite nem cria tipo.
- **Const. VI**: streak/badges derivados **em TS**; bucket de dia por offset fixo (São Paulo, UTC−3);
  `query()`; sem FK/GENERATED; `dc_session` (participante) / `X-Api-Key` (admin).
- **Determinismo**: mesma base ⇒ mesma resposta. Badges de streak usam `longest` (não se perdem).
