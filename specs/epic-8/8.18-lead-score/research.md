# Phase 0 — Research: Lead score

Decisões de produto travadas na spec (Clarifications 2026-07-03): por (lead, evento), on-demand, pesos
fixos. Aqui: a **tabela concreta de pesos**, a **agregação** e os **contratos de leitura**.

## D1 — Tabela de pesos (versionada em `lib/score.ts`)

- **Decisão**: `WEIGHTS: Record<string, number>` sobre a taxonomia FROZEN (CONTRIBUTING §3):

  | tipo | peso | razão |
  |---|---|---|
  | `survey.completed` | 10 | passou o gate — sinal forte de intenção |
  | `referral.signup`  | 8  | trouxe outro lead — alto valor |
  | `lesson.completed` | 6  | concluiu aula do evento |
  | `live.opened`      | 5  | esteve em live de aquecimento |
  | `ticket.shared`    | 4  | compartilhou ingresso |
  | `lesson.started`   | 3  | começou aula |
  | `content.opened`   | 2  | abriu conteúdo dia-1 |
  | `hub.viewed`       | 1  | acessou o hub |

- **Rationale**: escala 1–10 simples, ordena "intenção/ação" acima de "presença". Ajustável por deploy.
  Tipos ausentes do mapa ⇒ **0** (degradação segura — FR-002/FR-009).
- **Alternativas**: pesos por DB (config) — adiado (mais superfície); normalização/decay temporal —
  fora de escopo (evolução).

## D2 — Cálculo derivado por agregação (pg-mem-safe), peso em TS

- **Decisão**:
  - **Score de 1 lead**: `SELECT type, COUNT(*) n FROM engagement_events WHERE event_id=$1 AND lead_id=$2
    GROUP BY type`; em TS soma `WEIGHTS[type] * n` (tipo sem peso ⇒ 0). Devolve `{ score, breakdown[] }`.
  - **Ranking do evento**: `SELECT e.lead_id, e.type, COUNT(*) n, l.name, l.email FROM engagement_events e
    JOIN leads l ON l.id=e.lead_id WHERE e.event_id=$1 AND e.lead_id IS NOT NULL GROUP BY e.lead_id,
    e.type, l.name, l.email`; em TS agrupa por lead, soma pesos, ordena.
- **Rationale**: peso **em TS** (Const. VI: derivados na aplicação, não no SQL); `GROUP BY`/`COUNT`/`JOIN`
  são pg-mem-safe. Uma consulta por chamada. Determinístico (soma independe de ordem).
- **Alternativas**: `SUM(CASE type WHEN ... )` no SQL — jogaria os pesos para dentro do SQL (fora da
  camada TS, mais difícil de versionar/testar isolado); rejeitado. Persistir score — rejeitado na spec.

## D3 — Escopo do ranking: só leads com eventos

- **Decisão**: o ranking lista os leads do evento **que têm ≥1 evento de engajamento** (derivados da
  agregação). Leads sem nenhum evento (score 0) **não** aparecem nesta versão.
- **Rationale**: priorização foca em quem já engajou; incluir milhares de zeros é ruído. Simplicidade +
  uma única agregação. Incluir zeros (LEFT JOIN de todos os leads) fica como evolução se o produto pedir.
- **Alternativas**: LEFT JOIN de todos os leads do evento — mais completo, porém mais custo e ruído;
  adiado.

## D4 — Desempate estável do ranking (FR-005)

- **Decisão**: ordenar por `score` desc; empate ⇒ por `leadId` asc (estável e determinístico).
- **Rationale**: `leadId` é único e estável ⇒ ordem reproduzível. (Alternativa `created_at` exigiria
  trazer a coluna; `leadId` já está na agregação.)

## D5 — Contratos de leitura (X-Api-Key), read-only

- **Decisão**: duas rotas GET protegidas por `X-Api-Key` (reúso `getEvent` + `verifyApiKey`):
  - `GET /api/events/[eventId]/leads/[leadId]/score` → `{ leadId, score, breakdown: [{type,count,weight,points}] }`.
  - `GET /api/events/[eventId]/scores` → `{ scores: [{ leadId, name, email, score }] }` (ordenado).
- **Rationale**: espelha o padrão admin das rotas de provisionamento (401 sem/errada chave; 404 evento
  inexistente). GET = read-only (consumo por automação/admin). Sem admin UI (8.9).
- **Alternativas**: reusar `POST /api/events/[eventId]/leads` (ingestão) para ranking — mistura
  semânticas; rota dedicada é mais limpa.

## D6 — Degradação segura (FR-009)

- **Decisão**: lead sem eventos ⇒ `{ score: 0, breakdown: [] }`; lead inexistente/fora do evento ⇒
  também `score 0` (agregação vazia) — resposta consistente, sem erro. Ranking de evento sem eventos ⇒
  `{ scores: [] }`.
- **Rationale**: nunca quebrar por ausência de dado; resultado previsível (SC-007).

## Riscos & mitigação

- **Risco**: peso desatualizado vs. novos tipos futuros. **Mit.**: tipo sem peso ⇒ 0 (não quebra);
  adicionar peso é 1 linha em `WEIGHTS`, coberta por teste.
- **Risco**: custo do ranking com muitos eventos. **Mit.**: uma agregação `GROUP BY`; escala do piloto
  ok. Materialização fica para quando/se necessário (fora de escopo).
- **Risco**: `lead_id` nulo em eventos (permitido no schema). **Mit.**: filtrar `lead_id IS NOT NULL` no
  ranking; score por lead usa lead_id explícito.
