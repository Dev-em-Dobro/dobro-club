# Contract — Nivelamento com liberação progressiva por lead (8.16)

Contratos das superfícies afetadas. Reúso das rotas da 8.14; diferenças **em negrito**.

## 1. `GET /api/evento/conteudo` (lista — lead ou visitante)

Auth: cookie `dc_session` (opcional; visitante vê tudo travado). **Estende** a resposta por item.

**Response 200** (shape por item, aulas afetadas):

```jsonc
{
  "authenticated": true,
  "surveyAnswered": true,
  "items": [
    {
      "id": "cont_...",
      "kind": "lesson",
      "title": "Aula 1 — Nivelamento",
      "description": "…",
      "isGift": false,
      "releaseAt": null,                  // calendário 8.14 (ignorado p/ lesson)
      "releaseOffsetDays": 0,             // NOVO — offset em dias desde a entrada
      "releaseForLeadAt": "2026-07-03T12:00:00.000Z", // NOVO — data prevista p/ ESTE lead (entrada+offset)
      "available": true                    // agora usa isItemReleasedForLead(item, lead.createdAt, now)
    }
  ]
}
```

Regras:
- `available` = `authenticated && surveyAnswered && isItemReleasedForLead(item, lead.createdAt, now)`.
- Para `kind='lesson'`: liberação por-lead (offset × entrada); `releaseForLeadAt` = `entrada + offset`.
- Para `doc`/`codequest`: comportamento 8.14 inalterado (`isReleased` por `releaseAt`);
  `releaseForLeadAt` reflete `releaseAt`.
- Visitante / sem sessão: `available:false`; `releaseForLeadAt` pode vir `null` (sem âncora de lead).
- `resource` **nunca** é listado (revelado só no `abrir`) — inalterado.

## 2. `POST /api/evento/conteudo/[id]/abrir` (abrir — lead)

Auth: cookie `dc_session` (obrigatório). **Estende** a revalidação de liberação.

Fluxo (ordem importa):
1. Sessão válida? não ⇒ `401 {error:"unauthorized"}`.
2. Lead existe e não revogado? não ⇒ `404 {error:"not_found"}`.
3. Item existe no evento? não ⇒ `404 {error:"not_found"}`.
4. Gate da pesquisa satisfeito? não ⇒ `403 {error:"gated"}`.
5. **Liberado para o lead?** `isItemReleasedForLead(item, lead.createdAt, now)` — não ⇒
   **`403 {error:"not_released", releaseForLeadAt}`** (para lesson) ou `{releaseAt}` (demais).
6. Só então **`emit(content.opened, {kind, itemId})`** e devolve `{kind, resource, external}`.

Garantia (SC-004): aula não liberada ⇒ **nenhum** `content.opened` emitido.

## 3. `POST /api/events/[eventId]/conteudo` (provisionamento — admin)

Auth: `X-Api-Key`. **Estende** o corpo aceito.

**Request body** (campo novo, opcional):

```jsonc
{
  "kind": "lesson",
  "title": "Aula 2 — Nivelamento",
  "resource": "https://www.youtube.com/embed/...",
  "releaseOffsetDays": 2                 // NOVO — dias após a entrada do lead (default lógico 0)
}
```

- `releaseOffsetDays` ausente ⇒ persistido `null` ⇒ tratado como **0** no cálculo.
- Negativo/não-inteiro ⇒ tratado como 0 (não rejeita a criação).
- Curadoria típica de cadência 2-3 dias: aulas com offsets `0, 2, 5, 7…`.

## Notas de conformidade

- **Const. IV**: só `content.opened` (FROZEN) é emitido; nenhum tipo novo.
- **Const. VI**: coluna `int` sem FK/GENERATED; regra em `lib/content`; `query()`; cookie/`X-Api-Key`;
  `emit` best-effort.
- **Precedência 8.14**: `release_at` continua válido para não-aulas; ignorado para `lesson`.
