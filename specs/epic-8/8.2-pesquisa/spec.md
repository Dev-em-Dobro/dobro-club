# Spec — Story 8.2: Pesquisa Integrada como Gate (leitura em tempo real)

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.2 · **Status:** Draft (SDD)
> **Data:** 2026-07-01 · **Origem:** `epic-8-plataforma-evento-lancamento.md` (Story 8.2)
> **Trilho:** A — Dados & Engajamento (dono: Erackson) · **Depende de:** 8.1 (sessão), Fase 0 (emissor de eventos)
> **Stack:** Express `:3001` + React/Vite · Postgres (Neon) · convenções em [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)

---

## 1. Objetivo

Uma **pesquisa obrigatória na primeira tela** do evento, respondida pelo lead logo após o
primeiro acesso, com as respostas **lidas em tempo real** pelo estrategista no admin.

**Por que importa (estratégia):** *"personalizar durante o evento, não 15 dias depois no
debriefing"*. A pesquisa é o **gate**: enquanto o lead não responde, o conteúdo (aulas,
comunidade) fica bloqueado. Isso garante a meta de **>80% de resposta** (vs. ~40% em Google Forms)
e dá ao estrategista, ao vivo, a distribuição de perfil/nível da audiência.

---

## 2. Decisões desta spec

| Decisão | Escolha | Consequência |
|---|---|---|
| Personalização | **Manual pelo estrategista no MVP** | Guardamos `level`/respostas; auto-roteamento de conteúdo é fast-follow (v1.1) |
| Perguntas | **JSONB na linha do survey** (não tabela por pergunta) | Construtor flexível sem migração; pg-mem-safe (sem FK) |
| Gate | Lead precisa de **1 resposta** para liberar conteúdo | Checado no backend (`GET /survey` informa `answered`) e no roteamento do front |
| Formato | **Formulário + conversacional (chat)** compartilham o mesmo modelo de perguntas | Só muda a apresentação no front; backend é o mesmo |
| Nível | Uma pergunta marcada como `mapsToLevel` define `level` do lead | Base da hiperpersonalização (manual agora, automática depois) |

> ⚠️ **Convenção:** segue [`CONTRIBUTING.md §5`](../../../CONTRIBUTING.md) — **id texto** (`newId`), **sem FK**,
> **sem coluna GENERATED** (nível calculado em JS). Não copiar o padrão UUID/FK do spec 8.4.

---

## 3. Escopo

**Dentro (MVP):**
- Construtor de perguntas por evento: tipos `single` (múltipla escolha), `scale` (1–N), `text`.
- Pesquisa como **primeira tela** pós-login; **gate** que bloqueia conteúdo até responder.
- Submissão de respostas do lead (uma vez; re-submissão atualiza) associada ao lead.
- Cálculo de `level` a partir da pergunta marcada (`Iniciante/Intermediário/Avançado/Ninja`).
- **Emissão de `survey.completed`** (Fase 0 §3) → alimenta lead scoring (8.8) e webhook (8.9).
- **Dashboard admin ao vivo:** distribuições por pergunta + taxa de resposta (auth `X-Api-Key`).
- Front: formulário **e** modo conversacional (chat/onboarding).

**Fora (fast-follow / v1.1, costura pronta):**
- **Auto-roteamento** de conteúdo por nível/perfil (aqui só guardamos `level`).
- Scoring **por resposta** de pesquisa (peso por praça/perfil) — é Fase 2 da 8.8.
- Admin **UI** de construção da pesquisa (no MVP as perguntas entram via API — igual 8.4).

---

## 4. Modelo de dados

Segue convenções do [db.js](../../../server/db.js) — adicionar ao `SCHEMA`/`initSchema`.

```sql
CREATE TABLE IF NOT EXISTS surveys (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  title text,
  questions jsonb NOT NULL,   -- array de perguntas (ver formato abaixo)
  gate boolean NOT NULL,      -- true = bloqueia conteúdo até responder
  created_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_surveys_event ON surveys(event_id);

CREATE TABLE IF NOT EXISTS survey_responses (
  id text PRIMARY KEY,
  event_id text NOT NULL,
  survey_id text NOT NULL,
  lead_id text NOT NULL,
  answers jsonb NOT NULL,     -- { [questionId]: value }
  level text,                 -- derivado da pergunta mapsToLevel (calculado em JS)
  created_at timestamptz,
  updated_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_lead   ON survey_responses(lead_id);
-- Uma resposta por lead por survey (aplicado em JS: SELECT antes do INSERT, como createOrGetLead)
```

**Formato de uma pergunta** (item de `questions`):
```json
{
  "id": "q1",
  "type": "single",
  "prompt": "Qual seu nível com Node?",
  "options": ["Iniciante", "Intermediário", "Avançado", "Ninja"],
  "required": true,
  "mapsToLevel": true
}
```
- `type: "scale"` → `{ "min": 1, "max": 5 }` no lugar de `options`.
- `type: "text"` → sem `options`.
- Exatamente **uma** pergunta pode ter `mapsToLevel: true`; seu valor vira o `level` do lead.

---

## 5. Contratos de API

### `POST /api/events/:eventId/survey` — criar/definir a pesquisa (admin)
- **Auth:** `X-Api-Key` (`verifyApiKey`). 401 se inválida.
- **Body:** `{ title, questions, gate }`.
- **Validação:** ≥1 pergunta; ids únicos; no máx. 1 `mapsToLevel`; `options` não-vazio para `single`.
- **200:** `{ surveyId }`. Idempotente por evento: re-`POST` **substitui** a pesquisa do evento.

### `GET /api/events/:eventId/survey` — pesquisa + estado do gate (lead)
- **Auth:** cookie `dc_session`. 401 sem sessão.
- **200:** `{ survey: { id, title, questions, gate }, answered: true|false }`.
- `answered` = existe `survey_response` do lead → o front usa para liberar/segurar o conteúdo.

### `POST /api/events/:eventId/survey/responses` — submeter respostas (lead)
- **Auth:** cookie `dc_session`. 401 sem sessão.
- **Body:** `{ answers: { [questionId]: value } }`.
- **Validação:** todas as `required` presentes; valor compatível com o `type`/`options`.
- **Regra:** 1 resposta por lead — se já existe, **atualiza** (`updated_at`); senão cria.
- **Efeito:** calcula `level` (pergunta `mapsToLevel`) e **emite `survey.completed`**
  `{ surveyId, level }` (Fase 0 §3) → scoring/webhook.
- **200:** `{ level, answered: true }`.
- **Erros:** 400 (validação), 401 (sem sessão), 404 (sem pesquisa no evento).

### `GET /api/events/:eventId/survey/results` — dashboard ao vivo (admin)
- **Auth:** `X-Api-Key`.
- **200:**
```json
{
  "totalLeads": 120,
  "totalResponses": 98,
  "responseRate": 0.816,
  "byQuestion": {
    "q1": { "Iniciante": 40, "Intermediário": 35, "Avançado": 18, "Ninja": 5 },
    "q2": { "avg": 4.2, "distribution": { "1": 2, "2": 5, "3": 20, "4": 41, "5": 30 } }
  }
}
```
- Agregação calculada na hora (sem materialização no MVP; volume do piloto é pequeno).

---

## 6. Fluxos

**Feliz:** lead entra pelo magic link (8.1) → front chama `GET /survey` → `answered:false` e
`gate:true` → **redireciona para a pesquisa** (primeira tela) → lead responde →
`POST /responses` → `level` calculado + `survey.completed` emitido → conteúdo liberado →
estrategista vê a distribuição atualizar em `GET /results`.

**Gate:** enquanto `answered:false && gate:true`, qualquer tentativa de acessar Aulas/Comunidade
no front volta para a pesquisa. (O backend das outras stories não precisa checar o gate — é
responsabilidade do roteamento do front, para não acoplar Trilho B ao A.)

**Erros:** sem pesquisa configurada no evento → `GET /survey` retorna `survey:null` e o front
libera o conteúdo (sem gate). Falha de rede na submissão → estado preservado no front, retry.

---

## 7. UX — mobile-first premium (não-negociável)

- **Primeira tela do evento:** a pesquisa é a 1ª impressão pós-login. Impecável em 375–430px.
- **Modo conversacional (default no mobile):** uma pergunta por vez, estilo chat/onboarding
  ("Qual sua faixa de idade?" → "Qual seu nível?"), com progressão suave e barra de progresso.
- **Modo formulário:** fallback/desktop — todas as perguntas numa coluna única.
- **Alvos de toque ≥44px**, teclado numérico para `scale`, sem scroll horizontal, safe-areas.
- **Sem saída:** enquanto o gate está ativo, não há bottom-nav para outras seções (foco total).
- **Conclusão:** microinteração de "pronto!" antes de liberar o ambiente (sensação de progresso).

---

## 8. Critérios de aceite (mapeados ao epic 8.2)

- [ ] Pesquisa é a **primeira tela** após o primeiro acesso ao ambiente.
- [ ] **Gate** configurável: sem resposta, conteúdo (aula/comunidade) fica bloqueado.
- [ ] Construtor de perguntas por evento: **múltipla escolha, escala e texto**.
- [ ] Suporte a **formato conversacional (chat)** além de formulário.
- [ ] Respostas **associadas ao lead** e disponíveis **em tempo real** no admin.
- [ ] Dashboard de pesquisa com **agregação ao vivo** (distribuição por pergunta + taxa).
- [ ] `level` derivado da resposta (base da personalização manual do estrategista).
- [ ] `survey.completed` emitido para o lead scoring (8.8) e webhook (8.9).
- [ ] Meta de referência: **>80% de taxa de resposta** quando `gate:true`.
- [ ] Validado no **mobile** (premium, sem fricção), incl. público leigo.

---

## 9. Testes (TDD)

**Unit**
- Cálculo de `level` a partir da pergunta `mapsToLevel` (e ausência dela → `level:null`).
- Validação de resposta: `required` faltando → 400; valor fora de `options`/range → 400.
- Agregação de `results`: contagens por opção, média de `scale`, `responseRate` correta.

**Integração** (supertest + pg-mem via `setPool`)
- `POST /survey` (admin) cria pesquisa; sem `X-Api-Key` → 401.
- `GET /survey` (lead) retorna `answered:false` antes e `true` depois; sem sessão → 401.
- `POST /responses` cria resposta, calcula `level`, emite `survey.completed`.
- `POST /responses` repetido (mesmo lead) → **atualiza**, não duplica.
- `GET /results` reflete respostas em tempo real (agregação correta).

---

## 10. Costuras para o futuro (não implementar agora)

- **Auto-roteamento por nível (v1.1):** `level` já persistido; a 8.4 poderá filtrar aulas por nível.
- **Scoring por resposta (8.8 Fase 2):** `answers` guardado íntegro; pesos por praça/perfil depois.
- **Admin UI de construção (8.9):** hoje via `POST /survey`; depois um builder visual.

---

## 11. Perguntas em aberto

- **Uma pesquisa por evento** (assumido) vs. múltiplas etapas — proposto: uma no MVP.
- **Editar pesquisa após respostas existirem** — proposto: permitido, mas respostas antigas
  mantêm o schema com que foram coletadas (não retroagir). Confirmar com o estrategista.
