# Spec — Story 8.4: Aulas com Embed YouTube + Rastreamento de Visualização

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.4 · **Status:** Design Review  
> **Data:** 2026-06-30 · **Origem:** Epic 8 — Plataforma de Evento de Lançamento  
> **Stack:** Express backend + React frontend (Vite), PostgreSQL (Neon)

---

## Summary

Permitir que produtores entreguem aulas e lives dentro da plataforma com embed do YouTube, e medir comparecimento real (quem assistiu, quanto tempo) por lead. Aulas seguem padrão fixo semanal (seg/qua/sex = gravadas; ter/qui/sab/dom = lives com chat), liberadas diariamente às 20h.

---

## Goals

- [x] Permitir criação de aulas via API (sem interface admin no MVP)
- [x] Embed YouTube para aulas gravadas (vídeo simples)
- [x] Embed YouTube + chat nativo para lives
- [x] Rastrear quando lead assistiu (entrada/saída, duração)
- [x] Bloquear acesso até às 20h (countdown na UI)
- [x] Implementar padrão semanal fixo (seg/qua/sex=aula, ter/qui/sab/dom=live)
- [x] Fundação para lead scoring (Story 8.8) via eventos de visualização

---

## Non-Goals

- Quizzes interativos (Story 8.4 Phase 2)
- Gravações automáticas pós-live
- Moderação de chat ou respostas em tempo real
- Admin UI para gerenciar aulas (Story 8.9)
- Integração de notificações/lembretes (Story 8.11)
- Métricas agregadas (dashboard de aulas)

---

## Design

### 1. Arquitetura

```
[Lead clica em "Aulas"]
        ↓
[GET /api/events/:eventId/lessons]
        ↓
[Frontend lista aulas com status]
        ├─ ⏳ "Disponível em HH:MM" (antes das 20h)
        ├─ ✅ "Disponível agora" (após 20h)
        └─ ✔️ "Você assistiu" (já visto)
        ↓
[Lead clica em aula disponível]
        ↓
[Modal abre: YouTube embed + (chat se live)]
        ↓
[POST /api/lessons/:id/view-start] → registra entrada
        ↓
[Lead assiste]
        ↓
[POST /api/lessons/:id/view-end] → calcula duração
        ↓
[Duração salva em lesson_views]
```

### 2. Lógica de Disponibilidade

- **Event start date:** data/hora do evento (ex: sábado 6 de julho)
- **Aula de segunda:** disponível na segunda às 20h UTC
- **Aula de terça:** disponível na terça às 20h UTC
- **Etc.**

Cálculo: `availableAt = event_start_date + (dayOfWeek * 1 dia) + 20h`

**Verificação:**
- Se `now < availableAt`: aula **locked** (mostra countdown)
- Se `now >= availableAt`: aula **available** (embed liberado)

### 3. Determinação de Tipo (Aula vs Live)

Automático baseado em `dayOfWeek`:
- Domingo (0): Live
- Segunda (1): Aula
- Terça (2): Live
- Quarta (3): Aula
- Quinta (4): Live
- Sexta (5): Aula
- Sábado (6): Live

Mapeamento fixo — não configurável no MVP.

### 4. Frontend: Página `/e/:slug/aulas`

**Components:**
- `LessonList` — lista cards das aulas
- `LessonCard` — exibe status + countdown
- `LessonModal` — embed YouTube + chat (se live)
- `CountdownTimer` — mostra tempo até liberação

**Card states:**
```
┌─────────────────────────┐
│ Aula 1: Intro ao Node   │
│ 🎥 Aula gravada         │
│ ⏳ Disponível em 2h 30m │
└─────────────────────────┘

┌─────────────────────────┐
│ Aula 2: Middlewares     │
│ 📡 Live                 │
│ ✅ Disponível agora     │
│   [Assistir]            │
└─────────────────────────┘

┌─────────────────────────┐
│ Aula 3: Banco de Dados  │
│ 🎥 Aula gravada         │
│ ✔️ Você assistiu (45m)  │
└─────────────────────────┘
```

**Modal de visualização:**
- YouTube embed (100% width, responsive)
- Se live: chat nativo abaixo (expandível)
- Fechar modal → registra saída

### 5. Rastreamento de Visualização

**Eventos:**
1. `view-start`: lead abre a aula
2. `view-end`: lead fecha a aula (ou muda de página)

**Dados capturados:**
- `lesson_id`: qual aula
- `lead_id`: quem assistiu
- `viewed_at`: timestamp de entrada
- `exited_at`: timestamp de saída
- `duration_seconds`: `exited_at - viewed_at`

**Comportamento:**
- Se lead abrir a mesma aula 2x: registra 2 visualizações (permite re-watch)
- Fechar antes de 5 segundos: ainda registra (mesmo que acidental)
- Mudar de page/aba: POST view-end é chamado (via `beforeunload`)

---

## Data Model

### Table: `lessons`

```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_id TEXT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  type TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN day_of_week IN (0, 2, 4, 6) THEN 'live'
      ELSE 'aula'
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lessons_event_id ON lessons(event_id);
CREATE INDEX idx_lessons_day_of_week ON lessons(event_id, day_of_week);
```

### Table: `lesson_views`

```sql
CREATE TABLE lesson_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  duration_seconds INT GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (exited_at - viewed_at))::INT
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lesson_views_lesson ON lesson_views(lesson_id);
CREATE INDEX idx_lesson_views_lead ON lesson_views(lead_id);
CREATE INDEX idx_lesson_views_created ON lesson_views(created_at);
```

---

## API Contracts

### `POST /api/events/:eventId/lessons`

**Propósito:** Criar uma aula/live (API interna, sem auth no MVP)

**Auth:** Header `X-Api-Key` (validado contra `apiKeyHash` do evento)

**Request:**
```json
{
  "title": "Middlewares no Express",
  "youtubeId": "dQw4w9WgXcQ",
  "dayOfWeek": 2
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "eventId": "uuid",
  "title": "Middlewares no Express",
  "youtubeId": "dQw4w9WgXcQ",
  "dayOfWeek": 2,
  "type": "live",
  "availableAt": "2026-07-01T20:00:00Z",
  "createdAt": "2026-06-30T10:00:00Z"
}
```

**Errors:**
- 400: validação (dayOfWeek fora de range, youtubeId inválido)
- 401: API key inválida/ausente
- 404: evento não existe

---

### `GET /api/events/:eventId/lessons`

**Propósito:** Listar aulas do evento com status

**Auth:** Cookie de sessão (lead autenticado) OU sem auth (públicas)

**Query params:**
- `includeViews=true` — inclui dados de visualização do lead (requer sessão)

**Response (200):**
```json
{
  "lessons": [
    {
      "id": "uuid",
      "title": "Intro ao Node",
      "youtubeId": "...",
      "dayOfWeek": 1,
      "type": "aula",
      "availableAt": "2026-06-30T20:00:00Z",
      "status": "locked",
      "availableIn": 7200,
      "views": null
    },
    {
      "id": "uuid",
      "title": "Middlewares",
      "youtubeId": "...",
      "dayOfWeek": 2,
      "type": "live",
      "availableAt": "2026-07-01T20:00:00Z",
      "status": "available",
      "views": {
        "viewedAt": "2026-07-01T20:15:00Z",
        "durationSeconds": 2700
      }
    }
  ]
}
```

**Status:**
- `"locked"` — antes das 20h
- `"available"` — após 20h, não visto
- `"viewed"` — já visto (se `includeViews=true`)

---

### `POST /api/lessons/:lessonId/view-start`

**Propósito:** Registrar que lead começou a assistir

**Auth:** Cookie de sessão (obrigatório)

**Request:**
```json
{}
```

**Response (201):**
```json
{
  "viewId": "uuid",
  "lessonId": "uuid",
  "startedAt": "2026-07-01T20:15:00Z"
}
```

**Side effects:**
- Cria registro em `lesson_views` com `viewed_at = now()`
- Evento emitido para lead scoring (Story 8.8): `{ type: "lesson.started", lessonId, leadId }`

---

### `POST /api/lessons/:lessonId/view-end`

**Propósito:** Registrar que lead terminou (ou saiu da) visualização

**Auth:** Cookie de sessão (obrigatório)

**Request:**
```json
{
  "viewId": "uuid"
}
```

**Response (200):**
```json
{
  "viewId": "uuid",
  "durationSeconds": 2730,
  "completedAt": "2026-07-01T20:60:30Z"
}
```

**Side effects:**
- Atualiza `lesson_views.exited_at = now()`
- Calcula `duration_seconds` (automático via GENERATED ALWAYS)
- Evento emitido: `{ type: "lesson.completed", lessonId, leadId, durationSeconds }`

**Errors:**
- 400: `viewId` inválido ou não pertence ao lead
- 401: sem sessão

---

## Implementation Notes

### Frontend: Detectar Aula Disponível

```javascript
const isAvailable = (lesson, eventStartDate) => {
  const availableAt = new Date(eventStartDate);
  availableAt.setDate(availableAt.getDate() + lesson.dayOfWeek);
  availableAt.setHours(20, 0, 0, 0);
  return new Date() >= availableAt;
};
```

### Frontend: Limpar View ao Fechar

```javascript
window.addEventListener('beforeunload', () => {
  if (currentViewId) {
    navigator.sendBeacon(`/api/lessons/${lessonId}/view-end`, 
      JSON.stringify({ viewId: currentViewId })
    );
  }
});
```

### Backend: Calcular `availableAt`

```javascript
const getAvailableAt = (eventStartDate, dayOfWeek) => {
  const date = new Date(eventStartDate);
  date.setDate(date.getDate() + dayOfWeek);
  date.setHours(20, 0, 0, 0);
  return date;
};
```

### YouTube Chat Embed

Only render if `type === 'live'` and `isAvailable`:

```html
<iframe
  src="https://www.youtube.com/live_chat?v={youtubeId}&embed_domain=dobro.club"
  width="100%"
  height="400"
  allow="encrypted-media"
/>
```

> ⚠️ **Setup:** Admin deve verificar domínio no YouTube Studio uma vez (Settings > Moderation > Live chat)

---

## Testing

### Unit

- `availableAt` calculation para cada `dayOfWeek`
- `type` assignment (live/aula) baseado em `dayOfWeek`
- Duration calculation (exited_at - viewed_at)

### Integration

- `POST /lessons` cria lesson com type correto ✓
- `GET /lessons` retorna status correto (locked/available/viewed) ✓
- `POST /view-start` cria record em `lesson_views` ✓
- `POST /view-end` atualiza `exited_at` e calcula `duration_seconds` ✓
- Lead sem sessão não pode fazer POST (401) ✓
- Mesma aula assistida 2x cria 2 records ✓

### E2E (manual)

- Countdown mostra corretamente (24h antes) ✓
- Embed YouTube carrega corretamente ✓
- Chat aparece só para lives após 20h ✓
- Duração registrada com ±5 segundos de precisão ✓

---

## Sequencing & Fase

**MVP (v1):**
- Aulas básicas com embed
- Rastreamento simples (view-start/view-end)

**Phase 2 (v1.1):**
- Dashboard de métricas de aulas (Story 8.9)
- Quizzes (Story 8.4 full)

**Phase 3 (v2):**
- Gravações automáticas pós-live
- Análise de engajamento (Story 8.8 full)

---

## Open Questions

- **YouTube API limits?** Embed não requer API key (apenas iframe). Chat requer verificação de domínio (manual, uma vez).
- **Timezone handling?** `availableAt` em UTC; frontend converte para local do lead no countdown.
- **Re-watch metrics?** Permitir — cada visualização é registrada separadamente.
