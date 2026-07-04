# Phase 1 — Data Model: Nivelamento com liberação progressiva por lead

Reúso total dos modelos da 8.14/8.1. **Nenhuma tabela nova.** **Uma coluna nova** em `content_items`.

## Entidades

### `content_items` (ESTENDER — 8.14)

| Coluna | Tipo | Notas |
|--------|------|-------|
| … | … | colunas 8.14 inalteradas (`id`, `event_id`, `kind`, `title`, `description`, `resource`, `is_gift`, `release_at`, `position`, `created_at`) |
| **`release_offset_days`** | `int` NULL | **NOVA** — dias após a **entrada do lead** para liberar a aula. Aplica-se a `kind='lesson'`. `null`/inválido ⇒ tratado como **0** em TS. pg-mem-safe (int, sem FK/GENERATED/DEFAULT no DDL). |

- **Camada agnostic**: mapear `release_offset_days` ↔ `releaseOffsetDays` na borda de `lib/content.ts`
  (`ContentRow` → `ContentItem`), como os demais campos.
- `SELECT` de conteúdo passa a incluir `release_offset_days`. `ContentInput` aceita `releaseOffsetDays?:
  number | null`; `createContentItem` persiste (`null` se ausente).
- **Precedência**: `release_at` (calendário 8.14) **permanece**, mas para `kind='lesson'` é **ignorado**
  em favor do offset por-lead. Para `doc`/`codequest`, `release_at` continua governando.

### `leads` (REÚSO — 8.1/8.15)

| Campo usado | Origem | Papel |
|-------------|--------|-------|
| `createdAt` | `leads.created_at` | **Âncora** da liberação por-lead. Ausente/inválido ⇒ tratado como `now` (degradação segura). |

Sem alteração de schema em `leads`.

### `engagement_events` (REÚSO — 8.14)

- `content.opened` (tipo FROZEN existente) continua sendo o registro de acesso à aula. Insumo para
  **8.17 lead score** e **8.18 streak/badges** (fora desta story). Sem novo tipo.

## Regras derivadas (em TypeScript — `lib/content.ts`)

Todas puras, testáveis com pg-mem/sem DB:

```
DAY_MS = 86_400_000

sanitizeOffset(n) = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0

isLessonReleasedForLead(item, leadEntryDate, now):
    base = validDate(leadEntryDate) ?? now          // D5: dado ruim ⇒ agora
    return now.getTime() >= base.getTime() + sanitizeOffset(item.releaseOffsetDays) * DAY_MS

isItemReleasedForLead(item, leadEntryDate, now):     // seletor de precedência (D3)
    return item.kind === 'lesson'
        ? isLessonReleasedForLead(item, leadEntryDate, now)
        : isReleased(item, now)                       // calendário 8.14

releaseForLeadAt(item, leadEntryDate):                // rótulo "em breve"
    if item.kind !== 'lesson': return item.releaseAt  // mantém data de calendário
    base = validDate(leadEntryDate) ?? now
    return ISO(base + sanitizeOffset(item.releaseOffsetDays) * DAY_MS)
```

## Validação

- `releaseOffsetDays` no provisionamento: aceitar inteiro ≥ 0; negativo/`NaN`/ausente ⇒ tratado como 0
  no cálculo (não rejeita a criação — degradação previsível).
- `kind` e `title` seguem a validação existente da 8.14 (`ContentValidationError`).

## Transições de estado (por lead, por aula)

```
[gate da pesquisa não satisfeito] --responde pesquisa--> [gated liberado]
[aula: now < entrada+offset] --passa o tempo--> [aula liberada/reproduzível]
```

Sem estado persistido de "desbloqueio": a condição é recalculada a cada leitura (FR-005).
