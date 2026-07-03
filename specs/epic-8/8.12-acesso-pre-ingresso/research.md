# Research: Acesso pré-ingresso (Story 8.12)

Resolve as incógnitas do Technical Context. Cada decisão é framework-agnostic e pg-mem-safe.

---

## D1 — Modelo da credencial provisória: entidade nova vs. estado derivado

**Decision**: **Estado derivado**, sem tabela. A credencial provisória é o **mesmo ticket da 8.3**
(`buildTicket(lead)`), computado num `phase` = `provisoria` enquanto a janela de ingresso não abriu, e
`oficial` a partir de T-3 dias. Uma função pura `ingressoPhase(event, now)` decide o estado.

**Rationale**: na 8.3 o ingresso **já é derivado do lead** (`Ingresso/Credencial — derivada (sem
tabela)`). Criar uma entidade paralela duplicaria o modelo e contrariaria a diretriz do usuário (“o
fluxo do ingresso continua”). Sem tabela nova, não há FK nem migração de linhas na virada — a
convergência é só o `phase` mudando com o tempo.

**Alternatives considered**:
- *Tabela `credencials` separada que converge para ingresso*: rejeitada — duplica o derivado, exige
  migração de estado e viola pg-mem (tende a FK).
- *Coluna de estado no lead*: rejeitada — estado é função do tempo, não um fato persistido; calcular
  em TS evita `GENERATED`/desatualização.

**Convergência (US2/FR-006/FR-007)**: automática por tempo. Quem já tinha credencial mantém o mesmo
`lead` e vê o ingresso oficial quando `now ≥ windowOpensAt`; quem entra pela 1ª vez já dentro da
janela recebe `phase = oficial` direto (sem passo intermediário). A **atribuição de indicação**
(`referrer_lead_id`) é do lead e é preservada por construção.

---

## D2 — De onde vem a data que define a janela T-3

**Decision**: adicionar **`week_starts_at timestamptz` (nullable)** à tabela `events`, via
`ALTER TABLE events ADD COLUMN IF NOT EXISTS week_starts_at timestamptz` (mesmo padrão idempotente das
colunas da 8.3). Helper `ingressoWindowOpensAt(event) = week_starts_at − 3 dias`.

**Rationale**: `events` hoje não tem nenhuma data; a janela e a contagem no hub precisam de uma
referência por evento (não global) para suportar múltiplos eventos e ser testável. `nullable` +
degradação segura cobre eventos ainda sem data marcada.

**Alternatives considered**:
- *Env/const global de data*: rejeitada — não é por-evento, não testável, quebra multi-evento.
- *Coluna `ticket_opens_at` direta*: viável, mas guardar `week_starts_at` é mais expressivo (o hub
  também mostra “quando a semana começa”) e a abertura é derivada em TS (−3 dias), evitando
  duplicidade de verdade.

**Degradação (edge case)**: `week_starts_at IS NULL` ⇒ `ingressoWindowOpensAt = null` ⇒
`phase = provisoria` e o hub **não** promete data (sem contagem). Nunca converge por falta de data.

---

## D3 — Como checar o gate da pesquisa sem depender do armazenamento da 8.2

**Decision**: gate booleano lido de **`engagement_events`**: `hasCompletedSurvey(leadId)` = existe
linha `type = 'survey.completed'` para o lead. `survey.completed` **já está na taxonomia FROZEN**
(`lib/engagement.ts`) e é persistido pela 8.2 quando o lead responde.

**Rationale**: a 8.2 (pesquisa) ainda vive no Express e seu armazenamento não foi portado para `lib/`.
O contrato de eventos é **o único acoplamento permitido entre features** (Constituição IV), e um
booleano “respondeu?” é exatamente o que o gate precisa. Evita portar tabela de survey nesta story.

**Alternatives considered**:
- *Portar o store de survey da 8.2 para `lib/`*: rejeitada agora — amplia escopo; fica para a
  migração dedicada da 8.2 (pré-cutover, conforme plan da 8.3 §Transição).
- *Chamar o Express da 8.2 via HTTP*: rejeitada — reintroduz coexistência de runtimes/proxy (vetado
  na 8.3 research D9).

**Consequência**: enquanto a 8.2 não emitir `survey.completed` no ambiente Next, o gate trata como
“não respondeu” (conteúdo bloqueado) — comportamento seguro e alinhado ao gate.

---

## D4 — Superfície do hub: rota e reúso de sessão

**Decision**: nova área logada **`app/evento/page.tsx`** (client component sob `AuthProvider`,
padrão do `app/meu-acesso`) + Route Handler **`GET app/api/evento/route.ts`** autenticado por
`dc_session` (via `verifySession`/`cookies()`), devolvendo
`{ lead, phase, ticket, windowOpensAt, surveyAnswered }`.

**Rationale**: segue o padrão já existente (`AuthProvider` + `/api/me`). O hub é uma superfície nova e
distinta do `meu-acesso` (confirmação de acesso) — mantém responsabilidades separadas. A borda HTTP
fica fina; toda decisão (phase, gate, ticket) vem de `lib/`.

**Alternatives considered**:
- *Estender `/api/me`*: rejeitada — `/api/me` é identidade do lead; misturar phase/gate/ticket
  incharia o contrato e acoplaria consumidores.
- *Server Component lendo cookie no server*: viável e possível fast-follow; o padrão atual do projeto
  é client + `AuthProvider`, então mantemos consistência.

---

## D5 — Emissão do acesso ao hub (FR-011)

**Decision**: emitir **`hub.viewed`** via `emit(eventId, leadId, 'hub.viewed', { phase })` no
`GET /api/evento`. Requer **adicionar `hub.viewed` à taxonomia FROZEN** (CONTRIBUTING §3 +
`EngagementType` em `lib/engagement.ts`), de forma coordenada — precedente: `referral.signup` (8.3).

**Rationale**: Constituição IV exige medir toda ação relevante; “entrou no hub pré-evento” é sinal de
engajamento útil ao lead scoring (8.8). Nenhum tipo existente representa isso fielmente.

**Alternatives considered**:
- *Não emitir*: rejeitada — viola “tudo é mensurado”.
- *Reusar `lesson.started`/outro*: rejeitada — falseia a taxonomia e polui o scoring.

**Idempotência de métrica**: aceitável emitir a cada acesso (série temporal de visitas); a
**idempotência de credencial** (FR-004) é garantida por não haver criação de linha — o ticket é
derivado. Se, futuramente, quisermos “1ª visualização única”, filtra-se por `type+lead` na leitura
(sem mudar a emissão).
