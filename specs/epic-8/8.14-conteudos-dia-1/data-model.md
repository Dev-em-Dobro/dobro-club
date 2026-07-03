# Data Model: Conteúdos dia-1 (Story 8.14)

Convenções (Constituição v2.0.0 · CONTRIBUTING §5): IDs texto via `newId('prefix')`, **sem FK**, **sem
`GENERATED`/índice parcial** no caminho de teste, DB snake_case ↔ TS camelCase na borda, toda query
por `query()`. Esta story cria **1 tabela** e estende a taxonomia de engajamento.

---

## Entidade: ContentItem — *nova tabela `content_items`*

Modelo único para os três tipos de conteúdo (discriminador `kind`).

| Coluna (DB) | Campo (JS) | Tipo | Regras |
|-------------|-----------|------|--------|
| id | id | text (`cont_…`) | PK, `newId('cont')` |
| event_id | eventId | text | evento dono do item |
| kind | kind | text | `lesson` \| `doc` \| `codequest` (validado em TS) |
| title | title | text | obrigatório |
| description | description | text (nullable) | opcional |
| resource | resource | text | recurso: embed/URL do vídeo (`lesson`), URL/arquivo do doc (`doc`), **URL externa** (`codequest`). **Nunca** exposto se o item não estiver acessível |
| is_gift | isGift | boolean | `true` marca doc com presente (só relevante p/ `doc`) |
| release_at | releaseAt | timestamptz (nullable) | data de liberação (drip). `null` ⇒ liberado ao passar o gate |
| position | position | int | ordenação dentro do `kind` |
| created_at | createdAt | timestamptz | — |

```sql
CREATE TABLE IF NOT EXISTS content_items (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  resource text,
  is_gift boolean NOT NULL,
  release_at timestamptz,
  position int,
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_content_event ON content_items(event_id);
CREATE INDEX IF NOT EXISTS idx_content_event_kind ON content_items(event_id, kind);
```
(índices no bloco skippable de `initSchema`, como os demais.)

**Regras de negócio**:
- **`kind` válido**: `lesson`|`doc`|`codequest` — checado em TS na criação (sem enum no DB, pg-mem-safe).
- **`isGift`** só tem efeito visual/segmentação para `doc`; default `false`.
- **Ordenação**: por `kind`, depois `position` (nulls por último), depois `created_at`.

---

## Derivação: liberação (drip) — *TS puro, sem persistência de estado*

| Função (lib) | Assinatura | Regra |
|--------------|-----------|-------|
| `isReleased` | `(item, now = new Date()) => boolean` | `releaseAt == null` **ou** `now ≥ releaseAt` |

```text
[release_at = null]        -> liberado (assim que o gate passa)
[now < release_at]         -> bloqueado ("em breve" com data)
[now ≥ release_at]         -> liberado
```

---

## Acessibilidade por lead (combinação gate × drip)

Não persiste; é derivado na borda por item:

```text
acessível(item, lead, now) = hasCompletedSurvey(lead.id)  AND  isReleased(item, now)
```

- `hasCompletedSurvey` — reutilizado de `lib/engagement.ts` (8.12), lê `engagement_events(survey.completed)`.
- `resource` só entra no payload quando `acessível` é verdadeiro (ver contrato).

---

## Emissão: acesso a conteúdo — *taxonomia FROZEN estendida*

| type (novo) | Quando | Payload `data` |
|-------------|--------|----------------|
| `content.opened` | lead abre um item (`POST .../conteudo/[id]/abrir`) e ele é acessível | `{ kind, itemId }` |

> Adicionar `'content.opened'` ao union `EngagementType` (`lib/engagement.ts`) **e** à tabela FROZEN
> de CONTRIBUTING §3 (mudança coordenada). `emit()` já provê persistência + webhook best-effort.

---

## Relacionamentos (validados em TS, sem FK)

```text
Event --1:N--> ContentItem (event_id)
Lead  --(survey.completed)--> gate global  ─┐
ContentItem --(release_at)--> liberação      ├─ acessível(item, lead, now)
Lead  --1:N--> EngagementEvent (content.opened: { kind, itemId })
```
