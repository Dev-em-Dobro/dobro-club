# Data Model: Acesso pré-ingresso (Story 8.12)

Convenções (Constituição v2.0.0 · CONTRIBUTING §5): IDs texto via `newId('prefix')`, **sem FK**, **sem
`GENERATED`/índice parcial** no caminho de teste, DB snake_case ↔ TS camelCase mapeado na borda, toda
query por `query()` (`lib/db.ts`). Esta story **não cria tabelas** — estende `events` em 1 coluna e
adiciona derivações/leitura em TS.

---

## Entidade: Event — *estendida (1 coluna)*

Tabela `events` (já existente). Adiciona a referência de data que governa a janela de ingresso.

| Coluna (DB) | Campo (JS) | Tipo | Regras |
|-------------|-----------|------|--------|
| id | id | text (`evt_…`) | PK existente |
| slug | slug | text | existente |
| name | name | text | existente |
| status | status | text | existente |
| api_key_hash | — | text | existente (admin) |
| webhook_url | webhookUrl | text | existente |
| created_at | createdAt | timestamptz | existente |
| **week_starts_at** *(novo)* | **weekStartsAt** | timestamptz (nullable) | início da semana do evento; base da janela T-3 |

**Evolução (idempotente)** em `initSchema` (mesmo bloco skippable das colunas da 8.3):
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS week_starts_at timestamptz;
```

**Regras**:
- `weekStartsAt` **nullable**: evento pode ainda não ter data marcada ⇒ janela indefinida ⇒
  `phase = provisoria`, sem contagem no hub.
- `mapEvent` (em `lib/events.ts`) passa a expor `weekStartsAt` (ISO string | null).

---

## Derivação: Janela de ingresso — *sem persistência (TS puro)*

```text
ingressoWindowOpensAt(event) = weekStartsAt − 3 dias   (null se weekStartsAt for null)
```

| Função (lib) | Assinatura | Regra |
|--------------|-----------|-------|
| `ingressoWindowOpensAt` | `(event) => Date | null` | `weekStartsAt` menos 3 dias; `null` se sem data |
| `ingressoPhase` | `(event, now = new Date()) => 'provisoria' | 'oficial'` | `oficial` se `windowOpensAt != null && now ≥ windowOpensAt`; senão `provisoria` |

**Transições de estado (por tempo, não persistido):**
```text
[weekStartsAt = null]              -> phase = provisoria (estável; sem data prometida)
[now < windowOpensAt]              -> phase = provisoria
[now ≥ windowOpensAt (T-3 dias)]   -> phase = oficial   (convergência; mesmo lead/ticket)
```

---

## Derivação: Credencial/Ingresso — *reúso da 8.3 (sem tabela)*

A credencial provisória **não é entidade nova**: é o `Ticket` da 8.3 (`buildTicket(lead)` →
`{ imageUrl, qrValue, shareUrl }`) apresentado conforme o `phase`.

| phase | Apresentação |
|-------|--------------|
| `provisoria` | mesmo `Ticket`, rotulado como pré-evento (selo/estado “provisória”); UI trata o download/compartilhar conforme produto |
| `oficial` | `Ticket` da 8.3 sem alteração (ingresso liberado) |

> O `imageUrl` continua sendo a URL de transformação do Cloudinary (ou fallback local) — sem chamada
> bloqueante. A distinção visual `provisoria` é responsabilidade da **UI/composição** (selo), não de
> um novo asset obrigatório.

---

## Leitura: Gate da pesquisa — *sobre `engagement_events` (existente)*

Sem tabela nova. Gate booleano derivado do contrato de eventos (Constituição IV).

| Função (lib) | Assinatura | Regra |
|--------------|-----------|-------|
| `hasCompletedSurvey` | `(leadId) => Promise<boolean>` | existe ≥1 `engagement_events` com `type='survey.completed'` e `lead_id = leadId` |

```sql
SELECT 1 FROM engagement_events
WHERE lead_id = $1 AND type = 'survey.completed' LIMIT 1;
```

---

## Emissão: acesso ao hub — *taxonomia FROZEN estendida*

| type (novo) | Quando | Payload `data` |
|-------------|--------|----------------|
| `hub.viewed` | lead abre o hub pré-evento (`GET /api/evento`) | `{ phase }` |

> Requer adicionar `'hub.viewed'` ao union `EngagementType` (`lib/engagement.ts`) **e** à tabela FROZEN
> de CONTRIBUTING §3 (mudança coordenada — precedente `referral.signup`). Persistência e webhook já são
> providos por `emit()`; nada mais muda no schema de `engagement_events`.

---

## Relacionamentos (validados em TS, sem FK)

```text
Event --week_starts_at--> (deriva) Janela de ingresso --> phase do Ticket do Lead
Lead  --1:N--> EngagementEvent (survey.completed  → gate)
Lead  --1:N--> EngagementEvent (hub.viewed        → métrica de acesso)
```
