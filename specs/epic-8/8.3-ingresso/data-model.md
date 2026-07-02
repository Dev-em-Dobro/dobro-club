# Data Model: Ingresso/Credencial com indicação por QR (Story 8.3)

Convenções (Constituição v2.0.0 · CONTRIBUTING §5, não-negociáveis): IDs texto via `newId('prefix')`,
**sem FK**, **sem `GENERATED`/índice parcial** no caminho de teste, DB snake_case ↔ TS camelCase
mapeado na borda, toda query por `query()` de `lib/db.ts` (camada framework-agnostic).

---

## Entidade: Lead (participante) — *estendida*

Tabela `leads` (portada da 8.1 para `lib/db.ts`). Esta story **adiciona 2 colunas**. Tipos TS
correspondentes em `lib/leads.ts` (ex.: `type Lead = { id: string; eventId: string; ... }`).

| Coluna (DB) | Campo (JS) | Tipo | Regras |
|-------------|-----------|------|--------|
| id | id | text (`lead_…`) | PK, gerado por `newId('lead')` |
| event_id | eventId | text | evento ao qual pertence |
| name | name | text | obrigatório na captação (FR-001) |
| email | email | text | obrigatório, formato validado (FR-001) |
| phone | phone | text | obrigatório, formato validado (FR-001) |
| token | token | text | UNIQUE — base do magic link (8.1) |
| source | source | text | `captacao-externa` para geração pública |
| revoked | revoked | boolean | acesso revogável (8.1) |
| created_at | createdAt | timestamptz | — |
| last_seen_at | lastSeenAt | timestamptz | — |
| **photo_url** *(novo)* | **photoUrl** | text (nullable) | URL/`public_id` Cloudinary da foto; `null` ⇒ avatar padrão |
| **referrer_lead_id** *(novo)* | **referrerLeadId** | text (nullable) | id do lead indicador; `null` ⇒ sem indicação |

**Regras de negócio**:
- **Idempotência por e-mail/telefone** (FR-014): `createOrGetLead` já reaproveita lead existente;
  `photo_url`/`referrer_lead_id` só são definidos na **primeira** criação (`isNew`). Regeneração não
  troca o indicador nem o identificador.
- **Atribuição de indicação** (FR-009/FR-010): na criação, se `ref` (query) aponta para um lead
  existente do mesmo evento **e** `ref !== novo lead**, grava `referrer_lead_id = ref`. Auto-indicação
  ou indicador inexistente ⇒ `referrer_lead_id = null` (lead criado normalmente).
- **Sem FK**: `referrer_lead_id` é texto solto; a validade é checada em TS na hora da atribuição.

**Evolução (idempotente)** em `initSchema`:
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer_lead_id text;
```
(executadas com o mesmo try/catch dos índices, para não abortar em pg-mem.)

---

## Entidade: EngagementEvent — *nova (contrato FROZEN §3)*

Tabela `engagement_events` — schema **idêntico** ao contrato de CONTRIBUTING §3 (não alterar sozinho).

| Coluna (DB) | Campo (JS) | Tipo | Regras |
|-------------|-----------|------|--------|
| id | id | text (`engev_…`) | PK, `newId('engev')` |
| event_id | eventId | text | evento de origem |
| lead_id | leadId | text (nullable) | lead que originou (pode ser null) |
| type | type | text | taxonomia FROZEN (ver abaixo) |
| data | data | jsonb | payload por tipo |
| created_at | createdAt | timestamptz | — |

```sql
CREATE TABLE IF NOT EXISTS engagement_events (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  lead_id text,
  type text NOT NULL,
  data jsonb,
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_engevents_event ON engagement_events(event_id);
CREATE INDEX IF NOT EXISTS idx_engevents_lead  ON engagement_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_engevents_type  ON engagement_events(event_id, type);
```

**Tipos emitidos por esta story**:

| type | Quando | Payload `data` |
|------|--------|----------------|
| `referral.signup` | novo lead criado com `referrer_lead_id` válido (FR-009) | `{ referrerLeadId }` |
| `ticket.shared` | participante compartilha o ingresso (FR-011) | `{ channel }` |

> Nota de fronteira (decidida): a atribuição ocorre no momento da geração (8.3), então esta story
> **emite** `referral.signup` seguindo o payload FROZEN; a 8.7 **consome** para ranking/premiação. A
> tabela FROZEN de CONTRIBUTING §3 foi atualizada neste PR para refletir isso (emite=8.3, consome=8.7).

---

## Entidade: Ingresso/Credencial — *derivada (sem tabela)*

O ingresso não tem tabela própria; é computado a partir do lead:

- **imageUrl**: URL de transformação do Cloudinary = `template do evento` + overlay de texto (`name`)
  + overlay de imagem (`photoUrl` ou avatar padrão). Construída em `lib/ticket.ts`.
- **qrValue**: `https://<host>/ingresso?ref=<lead.id>` (FR-007/FR-008).
- **shareUrl**: mesma URL pública de convite do QR (para o botão compartilhar).

**Regra**: o QR/`shareUrl` são **públicos** e levam à tela de geração; nunca embutem o `token` do
magic link (SC-006 — zero vazamento de sessão).

---

## Relacionamentos (validados em TS, sem FK)

```text
Lead (indicado) --referrer_lead_id--> Lead (indicador)      [mesmo event_id]
Lead --1:N--> EngagementEvent (lead_id)
Event --1:N--> Lead (event_id)
Event --1:N--> EngagementEvent (event_id)
```

## Transições de estado (Lead)

```text
[visitante] --gera ingresso (nome/email/telefone + consentimento)--> [lead criado] (isNew)
[lead criado] --abre magic link--> [sessão ativa dc_session]
[lead criado] --compartilha--> emite ticket.shared (estado não muda)
[qualquer] --revoke (admin, 8.1)--> [revoked] (acesso negado)
```
