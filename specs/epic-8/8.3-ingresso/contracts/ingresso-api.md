# API Contracts: Ingresso/Credencial (Story 8.3)

**Route Handlers do Next.js (App Router)**, JSON. Distinção de auth por tipo de rota (Constituição
v2.0.0 · §5): **captação pública** por `slug` (sem chave); **ação de lead** por cookie `dc_session`
(via `cookies()` do Next); **admin** por `X-Api-Key` (inalterado, fora desta story). Cada Route
Handler é testável invocando a função exportada (`POST(req, { params })`) com um `Request`.

---

## 1. `POST /api/e/[slug]/ingresso` — gerar ingresso (público)

> Route Handler: `app/api/e/[slug]/ingresso/route.ts` → `export async function POST(...)`

Cria/reaproveita o lead, define foto e indicador, entrega o magic link e os dados do ingresso.

**Auth**: nenhuma (público). **Proteção**: rate limit (`makeLimiter`, ex.: 60/min por IP) +
validação + consentimento.

**Path params**: `slug` — slug público do evento (resolve o `eventId`).

**Request body**:
```json
{
  "name": "Maria Silva",
  "email": "maria@exemplo.com",
  "phone": "+5511999998888",
  "photoUrl": "https://res.cloudinary.com/.../maria.jpg",  // opcional; ausente ⇒ avatar padrão
  "ref": "lead_ab12cd34",                                   // opcional; id do indicador (do ?ref=)
  "consent": true                                            // obrigatório === true
}
```

**Validações**:
- `name`, `email`, `phone` obrigatórios e com formato válido → senão `400 { errors }` (FR-001).
- `consent !== true` → `400 { error: "consentimento obrigatório" }` (FR-013).
- `ref` inexistente no evento ou igual ao próprio lead → **ignorado** (não é erro) (FR-010).
- `photoUrl` ausente/ inválida → segue com avatar padrão (a recusa por tamanho/formato ocorre no
  cliente antes do upload) (FR-015).

**Comportamento**:
1. Resolve evento por `slug` → `404` se não existe.
2. `createOrGetLead(eventId, {name,email,phone})` → `{ lead, isNew }` (idempotente, FR-002/FR-014).
3. Se `isNew`: grava `photo_url` e (se `ref` válido) `referrer_lead_id`; dispara magic link
   (e-mail) best-effort; se `referrer_lead_id` setado, `emit(eventId, lead.id, 'referral.signup',
   { referrerLeadId })` (FR-009).
4. Monta `ticket` (imageUrl, qrValue, shareUrl).

**Response `200`**:
```json
{
  "leadId": "lead_ab12cd34",
  "isNew": true,
  "magicLink": "https://evento.exemplo.com/entrar/<token>",
  "ticket": {
    "imageUrl": "https://res.cloudinary.com/<cloud>/image/upload/<template>/.../maria.png",
    "qrValue": "https://evento.exemplo.com/ingresso?ref=lead_ab12cd34",
    "shareUrl": "https://evento.exemplo.com/ingresso?ref=lead_ab12cd34"
  }
}
```
> **FR-005**: o `magicLink` **é** retornado aqui para a tela dedicada exibi-lo na **mesma sessão**,
> logo após a geração (além do envio por e-mail). Ele **nunca** é devolvido pela rota de recuperação
> (endpoint 2). `qrValue`/`shareUrl` são públicos e nunca contêm o `token` (SC-006).

**Erros**: `400` (validação/consentimento), `404` (evento inexistente), `429` (rate limit).

---

## 2. `POST /api/e/[slug]/ingresso/recuperar` — recuperar link de acesso (público)

> Route Handler: `app/api/e/[slug]/ingresso/recuperar/route.ts` → `export async function POST(...)`

Reenvia o magic link ao **e-mail cadastrado**. Nunca exibe o link na resposta e não revela se o
e-mail existe (FR-017/FR-018).

**Auth**: nenhuma (público). **Proteção**: rate limit (mais estrito, ex.: 5/min por IP) para conter
enumeração/spam.

**Path params**: `slug` — slug público do evento.

**Request body**:
```json
{ "email": "maria@exemplo.com" }
```

**Comportamento**:
1. Resolve evento por `slug` → `404` se não existe.
2. Busca lead por e-mail no evento. **Se existir e não estiver revogado**: reenvia o magic link por
   e-mail (best-effort, reuso de `sendMagicLinkEmail`).
3. **Sempre** responde igual, exista ou não o e-mail (resposta neutra — FR-018).

**Response `200` (sempre, neutra)**:
```json
{ "ok": true, "message": "Se este e-mail estiver cadastrado, enviamos o link de acesso." }
```
> O corpo **nunca** contém o `magicLink` nem o `leadId` (SC-006, FR-017). O link vai apenas para a
> caixa de e-mail do dono.

**Erros**: `400` (e-mail ausente/inválido), `404` (evento inexistente), `429` (rate limit).

> **Nota de UX (FR-005)**: a exibição do magic link **na tela** só acontece na resposta do endpoint
> 1 (`POST .../ingresso`), na mesma sessão logo após a geração. A recuperação (este endpoint) nunca
> exibe — sempre reenvia por e-mail.

---

## 3. `POST /api/ingresso/share` — registrar compartilhamento (lead autenticado)

> Route Handler: `app/api/ingresso/share/route.ts` → `export async function POST(...)`

Emite `ticket.shared` quando o participante compartilha o ingresso.

**Auth**: cookie `dc_session` lido via `cookies()` do Next (lead logado) → senão `401`.

**Request body**:
```json
{ "channel": "whatsapp" }   // ex.: whatsapp | instagram | copy | outro
```

**Comportamento**: resolve `leadId`/`eventId` da sessão; `emit(eventId, leadId, 'ticket.shared',
{ channel })` (best-effort, não bloqueia); (FR-011).

**Response `200`**: `{ "ok": true }`

**Erros**: `401` (sem sessão), `400` (channel ausente).

---

## 4. Emissor compartilhado `emit()` — contrato interno (novo)

`lib/engagement.ts`:
```ts
// Persiste em engagement_events + dispara webhook de saída (best-effort, nunca bloqueia).
await emit(eventId, leadId, type, data);
```

**Webhook de saída** (reuso do padrão de `lib/webhook.ts`):
`POST {event.webhookUrl}` com `{ type, event:{id,slug}, lead:{id}, data }`. Falha é logada
(`.then/.catch`), **nunca** propaga erro para a resposta HTTP.

**Tipos desta story** (taxonomia FROZEN §3):

| type | Payload |
|------|---------|
| `referral.signup` | `{ referrerLeadId }` |
| `ticket.shared` | `{ channel }` |

---

## 5. Config externa (Cloudinary) — não é endpoint nosso

- **Upload não assinado** cliente→Cloudinary via upload preset por evento (retorna
  `secure_url`/`public_id`, enviado como `photoUrl` no endpoint 1).
- **Template do ingresso**: `public_id` do template de identidade do evento, usado na URL de
  transformação (montada em `lib/ticket.ts`).
