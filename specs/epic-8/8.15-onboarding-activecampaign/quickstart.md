# Quickstart: Onboarding via ActiveCampaign

Guia de validação ponta a ponta + runbook de configuração da AC. **Não** contém implementação (isso é
`tasks.md`).

## Pré-requisitos

- Suíte verde: `npm test` (Const. V).
- Evento provisionado (via DB/config, sem admin UI):
  - `events.api_key_hash` = hash da `X-Api-Key` entregue à AC.
  - `events.webhook_url` = URL de **entrada** da AC (automação de incoming webhook).
  - `events.onboarding_channel = 'active-campaign'` (para a AC assumir o e-mail).

## Validação automatizada (vitest + pg-mem)

Arquivo: `tests/onboarding.activecampaign.route.test.ts`. Cenários que **devem** passar:

1. **Canal `active-campaign` — sem e-mail, com webhook**: `POST /leads` (X-Api-Key ok, contato novo) ⇒ `200
   { isNew:true, magicLink }`; **não** chama `sendMagicLinkEmail`; **chama** `fireInscriptionWebhook`
   com o `magicLink`. (FR-003, R2)
2. **Canal `platform` (default) — mantém e-mail**: mesmo cenário com `onboarding_channel` ausente/
   `platform` ⇒ **chama** `sendMagicLinkEmail` (comportamento 8.1 preservado). (compat)
3. **Idempotência**: 2ª chamada com mesmo email/telefone ⇒ `isNew:false`, **mesmo** `magicLink`,
   **nenhum** webhook nem e-mail refeito. (FR-002, US2)
4. **Auth**: sem/`X-Api-Key` inválida ⇒ `401`, nenhum lead criado. (US3, FR-005)
5. **Email canônico**: contato com email ⇒ email presente no lead e no payload do webhook. (FR-007)

Mocks: `lib/email` e `lib/webhook` mockados para asserir "disparou / não disparou" (efeitos
best-effort, Const. VI).

## Teste manual (fumaça, opcional)

1. Provisionar evento de teste com `onboarding_channel='active-campaign'` e `webhook_url` apontando p/ um coletor
   (ex.: webhook.site).
2. `curl -X POST .../api/events/<eventId>/leads -H "x-api-key: <key>" -H "content-type: application/json"
   -d '{"name":"Teste","email":"t@ex.com","phone":"+5511999999999"}'` ⇒ `200 { magicLink }`.
3. Conferir no coletor que chegou `lead.created` com o `magicLink`; **nenhum** e-mail da plataforma.
4. Abrir o `magicLink` no celular ⇒ entra logado ⇒ cai no hub (8.12) / gate da pesquisa (8.2).

## Runbook de configuração da AC (externo)

1. **Tag/lista de qualificação** do evento na AC (o "gate" de quem vira lead).
2. **Automação de saída**: no gatilho da tag, chamar `POST /api/events/{eventId}/leads` com o
   `X-Api-Key` e mapear `name/email/phone` do contato.
3. **Automação de entrada**: receber `lead.created`, gravar `magicLink` num **campo do contato**.
4. **E-mail de onboarding**: template que usa o campo do `magicLink` (botão "Entrar no evento").
5. Confirmar a meta **SC-007**: link disponível ao lead em **< 5 min** da qualificação.

## Critérios de aceite cobertos

SC-001/003 (idempotência) · SC-002 (1 clique) · SC-004 (entrada → hub) · SC-005 (X-Api-Key/escopo) ·
SC-006 (mão única: nada escrito na AC pela plataforma) · SC-007 (< 5 min).
