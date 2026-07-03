# Contract: Conteúdos dia-1 — API (Story 8.14)

Três Route Handlers. Borda fina: gate/release/ocultação de `resource` vêm de `lib/content.ts` +
`lib/engagement.ts`. Auth de lead por `dc_session` (8.1); ingestão por `X-Api-Key` (admin).

---

## `GET /api/evento/conteudo` (lead)

Lista os itens de conteúdo do evento do lead, com estado de acessibilidade. **Nunca** inclui
`resource` de item bloqueado.

### Autenticação
- `dc_session` obrigatório. Sem sessão ⇒ **401**. Lead resolvido da sessão (nunca de query).

### Response `200 OK`
```json
{
  "surveyAnswered": true,
  "items": [
    {
      "id": "cont_ab12",
      "kind": "lesson",
      "title": "Lógica: variáveis e tipos",
      "description": "Aula de nivelamento 1",
      "isGift": false,
      "releaseAt": "2026-08-01T23:00:00.000Z",
      "available": true
    },
    {
      "id": "cont_cd34",
      "kind": "doc",
      "title": "E-book de presente",
      "isGift": true,
      "releaseAt": null,
      "available": false
    }
  ]
}
```

| Campo do item | Regra |
|---------------|-------|
| `available` | `surveyAnswered && isReleased(item, now)` |
| `releaseAt` | ISO 8601 \| `null` (drip); front mostra "em breve" quando futuro |
| `resource` | **ausente** neste endpoint (revelado só no `abrir`) |

- **INV-1**: `resource` NUNCA aparece aqui.
- **INV-2**: quando `surveyAnswered=false`, todos os itens vêm `available:false` (gate).
- Ordenação: `kind`, `position`, `created_at`.

### Erros: **401** sem sessão; **404** lead/evento inexistente.

---

## `POST /api/evento/conteudo/[id]/abrir` (lead)

Abre um item: valida acessibilidade **no servidor**, mede o acesso e devolve o `resource`.

### Autenticação
- `dc_session` obrigatório. Sem sessão ⇒ **401**.

### Comportamento
1. Carrega o item (do evento do lead). Não existe ⇒ **404**.
2. **Gate**: `hasCompletedSurvey(lead.id)` falso ⇒ **403** `{ error: "gated" }`.
3. **Release**: `isReleased(item, now)` falso ⇒ **403** `{ error: "not_released", releaseAt }`.
4. Emite `content.opened` com `{ kind, itemId }` (best-effort).
5. Responde `200`:
```json
{ "kind": "codequest", "resource": "https://codequest.exemplo/entrar", "external": true }
```

| Campo | Regra |
|-------|-------|
| `resource` | recurso do item (vídeo/doc/URL); só retornado quando acessível |
| `external` | `true` quando `kind='codequest'` (front abre em nova aba `rel="noopener"`) |

- **INV-3**: gate **e** release são revalidados no servidor (nunca confia no front).
- **INV-4**: `content.opened` só é emitido quando o acesso é concedido (200).

### Erros: **401** sem sessão; **403** `gated`/`not_released`; **404** item inexistente.

---

## `POST /api/events/[eventId]/conteudo` (admin)

Provisiona um item de conteúdo (sem admin UI nesta story).

### Autenticação
- Header **`X-Api-Key`** válido para o evento (`verifyApiKey`). Ausente/inválida ⇒ **401**.

### Request
```json
{
  "kind": "lesson",
  "title": "Lógica: variáveis e tipos",
  "description": "Aula de nivelamento 1",
  "resource": "https://youtube.com/embed/xyz",
  "isGift": false,
  "releaseAt": "2026-08-01T23:00:00.000Z",
  "position": 1
}
```

| Regra |
|-------|
| `kind` ∈ {`lesson`,`doc`,`codequest`} — senão **400** |
| `title` obrigatório — senão **400** |
| `releaseAt` opcional (ISO) — ausente ⇒ liberado ao passar o gate |
| `isGift` default `false` |

### Response `201`: `{ "id": "cont_ab12" }`. Erros: **400** payload inválido; **401** sem chave.

---

## Cobertura de testes esperada (TDD — escrever antes)

| Teste | Verifica |
|-------|----------|
| `content.release.test.ts` | `isReleased`: null⇒liberado, futuro⇒bloqueado, borda exata |
| `conteudo.route.test.ts` | 401 sem sessão; lista ordenada; `available` = gate×release; **não vaza `resource`** (INV-1/INV-2) |
| `conteudo.abrir.test.ts` | 403 `gated`/`not_released`; 200 devolve `resource`; emite `content.opened`; `external` p/ codequest (INV-3/INV-4) |
| `conteudo.ingest.test.ts` | 401 sem `X-Api-Key`; 400 payload inválido; 201 cria item |
