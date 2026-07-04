# Phase 0 — Research: Streak e badges

Decisões de produto travadas na spec. Aqui: bucket de dia/fuso, algoritmo do streak, tolerância,
catálogo concreto de badges e contratos.

## D1 — Bucket de dia por offset fixo (São Paulo = UTC−3), em TS

- **Decisão**: `DAY_TZ_OFFSET_MIN = -180`. `dayKey(iso, offsetMin=-180)` = `YYYY-MM-DD` de
  `new Date(ts + offsetMin*60_000)` lido em UTC. Dia ativo = dia com ≥1 `content.opened`/`live.opened`.
- **Rationale**: São Paulo **não tem DST desde 2019** ⇒ offset fixo é correto e **determinístico**;
  cálculo em TS respeita pg-mem-safe (sem `AT TIME ZONE`/date_trunc no SQL). Simples e testável.
- **Alternativas**: `AT TIME ZONE` no SQL — não portátil p/ pg-mem; `Intl`/tz database — desnecessário
  sem DST e menos determinístico em teste. Offset configurável fica como evolução.

## D2 — Algoritmo do streak (`computeStreak(dayKeys, today)`)

- **Decisão**: a partir do **conjunto** de dias ativos (dayKeys únicos):
  - `longest` = maior sequência de dias de calendário consecutivos.
  - `current` = sequência consecutiva terminando em **hoje** ou **ontem** (tolerância D3); se o dia mais
    recente for anterior a ontem ⇒ `current = 0`.
- **Rationale**: puro sobre um `Set<string>` de dayKeys; determinístico; mesmo-dia colapsa (Set) ⇒ nunca
  infla (SC-003). Ancorar em "hoje/ontem" dá a noção de streak **vigente**.
- **Alternativas**: contar a partir do último dia ativo sempre (sem âncora em hoje) — mostraria streak
  "vivo" de quem sumiu há semanas; rejeitado.

## D3 — Tolerância "hoje vs. ontem"

- **Decisão**: durante o dia de **hoje**, um streak cujo último dia ativo é **ontem** ainda é considerado
  **vigente** (não quebra até o fim de hoje). Se hoje **também** teve atividade, conta hoje.
- **Rationale**: não punir quem ainda vai voltar hoje (FR-001/edge case). Quebra só quando passa um dia
  **inteiro** sem atividade.
- **Alternativas**: exigir atividade **hoje** para manter o streak — punitivo/ansioso; rejeitado.

## D4 — Catálogo de badges (versionado em `lib/gamification.ts`)

- **Decisão**: `BADGES` = lista de `{ id, name, description, criterion, test(ctx) }`, com
  `ctx = { counts: Record<type,number>, streak: {current,longest}, score }`:

  | id | nome | critério (`test`) |
  |---|---|---|
  | `primeira-live` | Primeira live | `counts['live.opened'] >= 1` |
  | `explorador` | Explorador de conteúdo | `counts['content.opened'] >= 5` |
  | `streak-3` | 3 dias seguidos | `streak.longest >= 3` |
  | `streak-7` | 7 dias seguidos | `streak.longest >= 7` |
  | `engajado` | Engajado | `score >= 20` (lead score 8.18) |

- **Rationale**: regras fixas puras/testáveis; `longest` (não `current`) para badges de streak — uma
  conquista não se **perde** ao quebrar o streak. `engajado` reúsa `getLeadScore` (limiar 20 = alinhado à
  badge "quente" do score). Badge desconhecido/erro no `test` não derruba os demais (avaliação isolada).
- **Alternativas**: badges por `current` streak — perderia a conquista ao quebrar; rejeitado. Limiar de
  conteúdos configurável por DB — evolução.

## D5 — `getLeadGamification(eventId, leadId, now)` (2 consultas)

- **Decisão**:
  - **Atividade**: `SELECT type, created_at FROM engagement_events WHERE event_id=$1 AND lead_id=$2` →
    em TS: `counts` por tipo + `dayKeys` (de `content.opened`/`live.opened`) → `computeStreak`.
  - **Score**: reúsa `getLeadScore(eventId, leadId)` (8.18).
  - Monta `ctx` e chama `evaluateBadges`. Retorna `{ streak, badges }`.
- **Rationale**: 2 consultas simples; peso/limiar em TS. Determinístico.
- **Alternativas**: uma consulta agregada — misturaria contagem e datas; duas leituras claras é mais
  simples e barato o suficiente.

## D6 — Contratos: participante (`dc_session`) e admin (`X-Api-Key`)

- **Decisão**:
  - `GET /api/evento/gamificacao` (participante): resolve sessão → lead → `getLeadGamification(lead.eventId,
    lead.id)` → `{ streak, badges }`. 401 sem sessão.
  - `GET /api/events/[eventId]/leads/[leadId]/gamification` (admin `X-Api-Key`): `getEvent`+`verifyApiKey`
    → `getLeadGamification`. 401/404 conforme.
- **Rationale**: espelha os padrões existentes (rotas `/evento/*` por sessão; `/events/[eventId]/*` por
  `X-Api-Key`). Duas audiências, dois contratos.

## D7 — Degradação segura

- **Decisão**: lead sem eventos ⇒ `streak {current:0, longest:0}`, todos os badges **bloqueados**;
  `dayKeys` vazio; nunca lança. `test` de badge que erra ⇒ badge tratado como não-conquistado (isolado).
- **Rationale**: FR-010/SC-006; o painel mostra convite a começar.

## Riscos & mitigação

- **Risco**: bordas de fuso/meia-noite. **Mit.**: offset fixo (D1) + tolerância (D3); testes cobrem 23h/00h.
- **Risco**: novos tipos futuros não contam no streak. **Mit.**: streak olha só consumo de conteúdo
  (content/live) por decisão; ampliar é 1 lista.
- **Risco**: badge com `test` quebrado. **Mit.**: avaliação isolada por badge (try/catch), não derruba os demais.
