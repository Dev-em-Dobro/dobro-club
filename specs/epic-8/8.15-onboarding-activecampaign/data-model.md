# Data Model: Onboarding via ActiveCampaign

Reúso quase total do modelo da 8.1. **Uma** mudança: um discriminador de canal de onboarding no evento.

## Mudança: `events.onboarding_channel` (NOVA coluna)

| Campo | Tipo (DB) | TS | Regras |
|-------|-----------|----|--------|
| `onboarding_channel` | `text` | `onboardingChannel: 'platform' \| 'active-campaign'` | Default **`'platform'`** (aplicado em TS, não via `DEFAULT` do schema, p/ pg-mem). Valores fora do enum ⇒ tratados como `'platform'`. |

- **pg-mem-safe**: `text`, **sem** FK, **sem** `GENERATED`, **sem** índice novo. Adição idempotente no
  bloco skippable de `initSchema` (padrão da 8.14): `ALTER TABLE events ADD COLUMN IF NOT EXISTS
  onboarding_channel text` — e, no caminho de teste (pg-mem), a coluna já entra no `CREATE TABLE`.
- **Mapeamento** (borda snake↔camel em `lib/events.ts`): `onboarding_channel AS "onboardingChannel"`.
- **Semântica**:
  - `platform` → a plataforma envia `sendMagicLinkEmail` em `isNew` (comportamento 8.1 preservado).
  - `active-campaign` → a plataforma **não** envia o e-mail; a AC envia o onboarding. Webhook dispara em ambos.

### Helper (regra em `lib/events.ts`)

```
platformSendsOnboardingEmail(event): boolean
  → (event.onboardingChannel ?? 'platform') !== 'active-campaign'
```

Deriva o comportamento em TS (Const. VI: derivados calculados em código, não no schema).

## Entidades reusadas (sem mudança de forma)

### Lead *(reúso 8.1 — `lib/leads.ts`)*
- `id`, `event_id`, `name`, `email`, `phone`, `token` (único), `source`, `revoked`, `created_at`,
  `last_seen_at`, `photo_url`, `referrer_lead_id`.
- **Identidade**: casada por **email OU telefone** (`createOrGetLead`) → idempotência (US2).
- **`source`**: `"captacao-externa"` já marca a origem AC (usado por FR-010 / métricas).
- **Email = identidade canônica** do onboarding (garantido pela captação; não é regra nova de schema).

### Event *(reúso 8.1 — `lib/events.ts`)*
- `id`, `slug`, `name`, `status`, `api_key_hash`, `webhook_url`, `week_starts_at`, **+
  `onboarding_channel`** (novo).
- **`api_key_hash`**: valida a chamada da AC (`X-Api-Key`).
- **`webhook_url`**: destino do `lead.created` (URL de entrada da AC).

### Engagement event *(reúso — `lib/engagement.ts` / tabela `engagement_events`)*
- Nenhum tipo novo. A origem AC é medível por `lead.created` (8.1) + `lead.source`. Taxonomia FROZEN
  intacta (FR-010).

## Estados / transições

- **Contato na AC** entra na tag de qualificação → AC chama ingestão →
  - lead **novo** (`isNew=true`): cria lead + token; dispara webhook (`lead.created` + `magicLink`);
    e-mail **só** se `onboarding_channel='platform'`.
  - lead **existente** (`isNew=false`): retorna o mesmo lead/token; **não** refira webhook nem e-mail
    (idempotência — US2).
- **Lead clica no magic link** → `/entrar/[token]` → sessão `dc_session` → hub 8.12 (gate 8.2).
- **Revogado** (`revoked=true`) → `/entrar` rejeita, mesmo com o link ainda guardado na AC.
