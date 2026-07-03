# Contribuindo — Dobro Club (Epic 8)

Guia de trabalho para os dois desenvolvedores do projeto (**Erackson** e **Pablo**).
Objetivo: construir o MVP do Epic 8 em paralelo **sem pisar um no calo do outro**.

> Leia junto com [`epic-8-plataforma-evento-lancamento.md`](./epic-8-plataforma-evento-lancamento.md) (o quê e por quê) e os specs em [`specs/epic-8/`](./specs/epic-8/) (como).

---

## 1. Divisão de trabalho — dois trilhos

O épico é **sequencial de propósito** (8.1 → 8.2 → 8.8 → ...). O que permite paralelizar
é a **espinha de eventos de engajamento** (ver §3): toda feature só *emite* eventos; quem
consome (scoring/admin) não precisa saber como a feature funciona por dentro.

| Trilho | Dono | Stories (ordem) | Natureza |
|---|---|---|---|
| **A — Dados & Engajamento** | **Erackson** | 8.2 Pesquisa-gate → 8.8 Lead Scoring → 8.9 Admin/Métricas | Espinha: consome eventos, agrega, exibe pro estrategista |
| **B — Crescimento & Conteúdo** | **Pablo** | 8.3 Ingresso → 8.4 Aulas → 8.7 Indicações | Superfície: features autocontidas que *emitem* eventos |

**Regra de ouro:** o Trilho B nunca importa código do Trilho A e vice-versa. O único
acoplamento é o **contrato de eventos** (§3) e a **fundação compartilhada** (§2).

### Riscos já mapeados
- **8.9 Admin não é "por último".** Cada feature que entra ganha seu card/painel no admin,
  incrementalmente. Por isso o Admin fica no Trilho A, crescendo junto.
- **8.8 Lead Scoring depende de eventos de todo mundo.** Só funciona com o contrato de §3 travado.

---

## 2. Fase 0 — fundação compartilhada (fazer JUNTOS, antes de ramificar)

Nada de feature branch nasce antes disto estar na `main`. Os dois partem daqui.

- [x] **Auth** — magic link, sessão `dc_session`, `X-Api-Key` por evento (8.1, pronto).
- [x] **Camada de dados** — `query()`/`setPool()` + `SCHEMA` idempotente ([server/db.js](server/db.js)).
- [ ] **Emissor de eventos de engajamento** + tabela `engagement_events` + webhook de saída (§3). **← construir agora, juntos.**
- [ ] **Casca do Admin** — layout + auth por `X-Api-Key` que os dois trilhos preenchem.

---

## 3. Contrato de eventos de engajamento (FROZEN — não mude sozinho)

Este é o contrato que desacopla os dois trilhos. Alterá-lo exige acordo dos dois.

**Tabela** (segue as convenções de §5 — id texto, sem FK, pg-mem-safe):

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

**Emissor** — `server/engagement.js`:

```js
// Toda feature chama isto. Persiste + dispara webhook (best-effort).
await emit(eventId, leadId, type, data);
```

**Taxonomia de `type`** (dono = quem emite; consumidor = scoring/admin):

| type | Emitido por | Consumido por | Payload `data` |
|---|---|---|---|
| `survey.completed` | 8.2 (Trilho A) | 8.8/8.9 | `{ surveyId, level }` |
| `lesson.started`   | 8.4 (Trilho B) | 8.8/8.9 | `{ lessonId }` |
| `lesson.completed` | 8.4 (Trilho B) | 8.8/8.9 | `{ lessonId, durationSeconds }` |
| `ticket.shared`    | 8.3 (Trilho B) | 8.8/8.9 | `{ channel }` |
| `referral.signup`  | **8.3** (na geração via indicação) | **8.7** (ranking/premiação) | `{ referrerLeadId }` |
| `hub.viewed`       | **8.12** (acesso ao hub pré-evento) | 8.8/8.9 | `{ phase }` |
| `content.opened`   | **8.14** (abrir conteúdo dia-1) | 8.8/8.9 | `{ kind, itemId }` |

> **Nota (8.3):** a atribuição de indicação acontece no momento da geração do ingresso, então a
> **8.3 emite** `referral.signup`; a **8.7 consome** para ranking/premiação. Ajuste acordado entre os
> donos dos trilhos.

> **Nota (8.12):** o hub pré-evento emite `hub.viewed` a cada acesso do lead (`phase` =
> `provisoria`/`oficial`); alimenta o lead scoring (8.8). Novo tipo adicionado de forma coordenada.

> **Nota (8.14):** abrir um item de conteúdo dia-1 emite `content.opened` (`kind` =
> `lesson`/`doc`/`codequest`, `itemId`); alimenta o lead scoring (8.8). Novo tipo coordenado.

Novos tipos: adicione a linha nesta tabela **no mesmo PR** que passa a emiti-los.

**Webhook de saída:** cada `emit()` também faz `POST {event.webhookUrl}` com
`{ type, event:{id,slug}, lead:{id}, data }` — mesmo padrão best-effort/retry de
[server/webhook.js](server/webhook.js). Consumível por ManyChat/SendFlow/n8n (8.9).

---

## 4. Fluxo de branches — trunk-based leve (somos 2, não use gitflow)

- `main` protegida. **Feature branch curta por story:** `feat/8.2-pesquisa`, `feat/8.3-ingresso`.
- **PR pequeno + review cruzado** antes de mergear. Com 2 pessoas, o review do outro é o maior ganho de qualidade.
- **Rebase na `main` todo dia** para não acumular divergência.
- A Fase 0 (§2) entra na `main` **antes** de qualquer feature branch. Os dois rebasam em cima.
- **Zonas de propriedade:** editar [server/app.js](server/app.js) ou o `SCHEMA` = avisar o outro,
  fazer PR isolado e mergear rápido (são os únicos arquivos "de todos").

Commits: mensagem no imperativo, referenciando a story (ex.: `feat(8.2): survey gate endpoint`).

---

## 5. Convenções de código (não-negociáveis — alinham os dois trilhos)

Extraídas do 8.1 já implementado. **O spec da 8.4 diverge disto (UUID/FK/GENERATED) — o código vence.**

- **IDs:** texto via `newId('prefix')` (ex.: `lead_ab12…`, `ev_…`), **não** UUID.
- **Sem foreign keys** e **sem colunas `GENERATED`/índice parcial** no schema que roda em teste —
  o pg-mem não suporta. Calcule derivados (duração, tipo) **em JS**, não no banco.
- **Schema** = strings `CREATE TABLE IF NOT EXISTS` idempotentes, adicionadas ao `SCHEMA`/`initSchema`.
- **DB snake_case ↔ JS camelCase** — mapeie na borda (ver `mapLead` em [server/leads.js](server/leads.js)).
- **Toda query** passa por `query()` de [server/db.js](server/db.js) (testes injetam pg-mem via `setPool`).
- **Auth por tipo de rota:** endpoints de **lead** usam cookie `dc_session`; endpoints de
  **admin/ingestão** usam header `X-Api-Key` (validado com `verifyApiKey`).
- **Efeitos externos** (webhook, e-mail) são **best-effort**: `.then/.catch` logado, **nunca** bloqueiam a resposta.

---

## 6. Como rodar e testar

```bash
npm install
npm run db:init      # cria schema (Neon/Postgres via DATABASE_URL — ver .env.example)
npm run seed         # dados de exemplo
npm run dev          # server :3001 + vite web juntos
npm run link         # gera um magic link de teste

npm test             # vitest (usa pg-mem em memória — não precisa de banco)
npm run test:watch
```

**TDD é o padrão do projeto** (ver `tests/server/`): escreva o teste da rota/regra antes.
Todo PR deve manter `npm test` verde.

---

## 7. Spec-Driven (Spec Kit)

Cada story passa por: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
Specs vivem em [`specs/epic-8/<story>/`](./specs/epic-8/). Cada dono toca os specs do seu trilho.
Rode o Claude Code com a raiz apontada para **este** diretório (`dobro-club/`) para ver os comandos `/speckit-*`.
