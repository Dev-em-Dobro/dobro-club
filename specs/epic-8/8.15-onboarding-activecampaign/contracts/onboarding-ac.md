# Contracts: Onboarding via ActiveCampaign

Dois contratos HTTP (ambos **reúso da 8.1**, um estendido) + o contrato de configuração da AC.

## 1. Ingestão — AC → plataforma *(reúso 8.1, comportamento estendido)*

### `POST /api/events/{eventId}/leads`
- **Chamador**: automação da AC (quando o contato entra na tag/lista de qualificação do evento).
- **Auth**: header `X-Api-Key` (validado contra `events.api_key_hash`). `401` se inválida.
- **Body**: `{ name?, email?, phone? }` — **email OU phone** obrigatório (`validateLeadInput`).
- **Idempotência**: contato já existente (mesmo email/phone) ⇒ retorna o **mesmo** lead/token; **não**
  refira e-mail nem webhook.
- **200**: `{ "leadId": string, "magicLink": string, "isNew": boolean }`.
- **Efeitos colaterais** (best-effort, não bloqueiam a resposta), **somente quando `isNew=true`**:
  - **Webhook** `lead.created` disparado para `events.webhook_url` (ver §2) — **em qualquer canal**.
  - **E-mail** de magic link enviado pela plataforma **somente se `onboarding_channel='platform'`**
    (no canal `active-campaign`, a AC envia o onboarding).
- **Erros**: `400` (validação/`eventId` inválido), `401` (api key), `404` (evento inexistente).

**Delta desta story vs. 8.1**: o envio do e-mail pela plataforma passa a ser **condicional ao
`onboarding_channel`**. Todo o resto é idêntico.

## 2. Webhook de inscrição — plataforma → AC *(reúso 8.1, inalterado)*

### `POST {events.webhook_url}`  (a AC escuta nessa URL)
```json
{
  "type": "lead.created",
  "event": { "id": "evt_...", "slug": "..." },
  "lead":  { "id": "lead_...", "name": "...", "email": "...", "phone": "..." },
  "magicLink": "https://{host}/entrar/{token}"
}
```
- **Entrega**: `POST` best-effort com **1 retry** e timeout de 5s (`lib/webhook.ts`).
- **Uso pela AC**: mapear `magicLink` (e opcionalmente `lead.email`) para um **campo do contato** e usar
  esse campo no **e-mail de onboarding**. O `magicLink` é **reutilizável** (o lead pode clicar N vezes).

## 3. Entrada do lead — clique no onboarding *(reúso 8.1, inalterado)*

### `GET /entrar/{token}`
- Token válido e não revogado ⇒ seta cookie `dc_session`, atualiza `last_seen_at`, **302** para o hub
  do evento (8.12) → gate da pesquisa (8.2).
- Token inválido/revogado ⇒ **302** para tela amigável de "link inválido / pedir novo acesso".

## 4. Configuração da AC *(externo — runbook, ver quickstart.md)*

Contrato operacional que a AC precisa satisfazer (não é código da plataforma):
- **Saída da AC** → chamar `POST /api/events/{eventId}/leads` com `X-Api-Key` do evento, mapeando
  `name/email/phone` do contato, **no gatilho da tag/lista de qualificação**.
- **Entrada da AC** ← receber `lead.created`, guardar `magicLink` num campo do contato, e disparar o
  **e-mail de onboarding** com esse campo.
- **Evento provisionado** com `webhook_url` = URL de entrada da AC e `onboarding_channel='active-campaign'`.
