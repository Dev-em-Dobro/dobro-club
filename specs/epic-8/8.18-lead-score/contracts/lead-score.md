# Contract — Lead score (8.18)

Duas rotas GET **read-only**, protegidas por `X-Api-Key` (reúso `getEvent` + `verifyApiKey`). Nenhuma
emissão; só consulta derivada de `engagement_events`.

## 1. `GET /api/events/[eventId]/leads/[leadId]/score` (score de um lead — admin)

Auth: `X-Api-Key`.

Fluxo: eventId válido → `getEvent` (404 se não existe) → `verifyApiKey` (401) → `getLeadScore`.

**Response 200**:

```jsonc
{
  "leadId": "lead_...",
  "score": 21,
  "breakdown": [
    { "type": "survey.completed", "count": 1, "weight": 10, "points": 10 },
    { "type": "live.opened",      "count": 1, "weight": 5,  "points": 5  },
    { "type": "content.opened",   "count": 3, "weight": 2,  "points": 6  }
  ]
}
```

- Lead sem eventos / fora do evento ⇒ `{ leadId, score: 0, breakdown: [] }` (200, degradação segura).
- `sum(breakdown.points) === score` sempre. Tipo sem peso ⇒ `weight:0, points:0`.

**Erros**: `401` sem/`X-Api-Key` errada; `404` evento inexistente; `400` eventId malformado.

## 2. `GET /api/events/[eventId]/scores` (ranking do evento — admin)

Auth: `X-Api-Key`.

**Response 200**:

```jsonc
{
  "scores": [
    { "leadId": "lead_a", "name": "Ana",  "email": "a@x.com", "score": 21 },
    { "leadId": "lead_b", "name": "Bruno","email": "b@x.com", "score": 12 }
  ]
}
```

- Ordenado por `score` **desc**; empate ⇒ `leadId` **asc** (estável, FR-005).
- Inclui os leads com **≥1 evento** no evento (research D3); evento sem eventos ⇒ `{ scores: [] }`.

**Erros**: `401` sem/`X-Api-Key` errada; `404` evento inexistente; `400` eventId malformado.

## Notas de conformidade

- **Const. IV**: só **consome** `engagement_events`; **não** emite nem cria tipo novo.
- **Const. VI**: score derivado **em TS** (pesos em `lib/score.ts`); `query()` com GROUP BY/JOIN
  (pg-mem-safe); `X-Api-Key` na borda; sem FK/GENERATED; sem estado persistido.
- **Determinismo**: mesma base ⇒ mesma resposta.
