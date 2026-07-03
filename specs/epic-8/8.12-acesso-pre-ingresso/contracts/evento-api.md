# Contract: Hub do evento — `GET /api/evento` (Story 8.12)

Route Handler autenticado (lead) que alimenta o hub pré-evento. Borda fina: toda decisão vem de
`lib/` (`ingressoPhase`, `hasCompletedSurvey`, `buildTicket`). Reúso de sessão da 8.1 (`dc_session`).

---

## `GET /api/evento`

Retorna o estado do hub para o lead da sessão: credencial/ingresso conforme a janela, quando o
ingresso abre, e se o gate da pesquisa está satisfeito. Emite `hub.viewed` (best-effort).

### Autenticação
- Cookie **`dc_session`** obrigatório (`verifySession`). Sem sessão válida ⇒ **401**.
- O lead é resolvido **da sessão**, nunca de query/param (FR-009: hub de um lead nunca é exposto a
  outro).

### Request
- Método: `GET`. Sem corpo. Sem query params relevantes.

### Response `200 OK`
```json
{
  "lead": {
    "id": "lead_ab12",
    "name": "Maria Silva",
    "eventId": "evt_x1"
  },
  "phase": "provisoria",
  "ticket": {
    "imageUrl": "https://res.cloudinary.com/.../evt-template.png",
    "qrValue": "https://host/ingresso?ref=lead_ab12",
    "shareUrl": "https://host/ingresso?ref=lead_ab12"
  },
  "windowOpensAt": "2026-08-10T00:00:00.000Z",
  "surveyAnswered": false
}
```

| Campo | Tipo | Regra |
|-------|------|-------|
| `lead` | objeto | id/name/eventId do lead da sessão (sem `token`/dados sensíveis — SC-005) |
| `phase` | `"provisoria" \| "oficial"` | `ingressoPhase(event, now)` |
| `ticket` | objeto | `buildTicket(lead)` (mesmo contrato da 8.3) |
| `windowOpensAt` | ISO 8601 \| `null` | `ingressoWindowOpensAt(event)`; `null` se evento sem `weekStartsAt` |
| `surveyAnswered` | boolean | `hasCompletedSurvey(lead.id)` — governa o gate de conteúdo no hub |

### Efeitos colaterais
- Emite `emit(eventId, leadId, "hub.viewed", { phase })` — **best-effort**, nunca bloqueia nem falha a
  resposta (Constituição IV/VI).

### Erros
| Status | Quando | Corpo |
|--------|--------|-------|
| **401** | sem `dc_session` válida | `{ "error": "unauthorized" }` |
| **404** | lead/evento da sessão não encontrado (ex.: revogado) | `{ "error": "not_found" }` |
| **500** | falha inesperada de leitura | `{ "error": "internal" }` |

### Invariantes / regras de negócio
- **INV-1**: `phase = "oficial"` ⟺ `windowOpensAt != null && now ≥ windowOpensAt`. Caso contrário
  `"provisoria"`.
- **INV-2**: nenhuma linha é criada para representar a credencial (derivada) — acessos repetidos não
  duplicam nada (FR-004).
- **INV-3**: `windowOpensAt = null` ⇒ sempre `phase = "provisoria"` e sem promessa de data (FR-005,
  degradação segura).
- **INV-4**: `ticket` idêntico ao da 8.3; a distinção visual de `provisoria` é da UI, não do contrato.

---

## Cobertura de testes esperada (TDD — escrever antes)

| Teste | Verifica |
|-------|----------|
| 401 sem sessão | acesso negado, sem vazar lead |
| phase `provisoria` (now < janela) | INV-1 |
| phase `oficial` (now ≥ janela) | INV-1, convergência |
| `weekStartsAt = null` | INV-3 (provisoria + `windowOpensAt: null`) |
| `surveyAnswered` reflete `survey.completed` | gate |
| emite `hub.viewed` com `{ phase }` | FR-011 |
| acessos repetidos não criam credencial | INV-2 |
