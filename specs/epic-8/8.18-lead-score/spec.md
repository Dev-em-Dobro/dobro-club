# Feature Specification: Lead score (pontuação de engajamento por lead)

**Feature Branch**: `feat/8.18-lead-score`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Dar a cada lead um score de engajamento por evento, derivado dos eventos que ele já emitiu (pesquisa, hub, conteúdo, live, aulas, indicações…), para priorização comercial/personalização durante o lançamento. Só consome o contrato de eventos; não emite nada novo, não faz streak/badges nem admin UI."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.18 (é a **8.8 do épico — Lead Scoring**) · **Trilho:** A — Dados & Engajamento
> **Depende de:** contrato de eventos de engajamento (CONTRIBUTING §3) já emitido por 8.2
> (`survey.completed`), 8.4 (`lesson.started`/`lesson.completed`), 8.3 (`ticket.shared`/`referral.signup`),
> 8.12 (`hub.viewed`), 8.14 (`content.opened`), 8.17 (`live.opened`).
> **Fronteira:** esta story **só consome** eventos e calcula o score. NÃO emite novos eventos de
> superfície, NÃO faz **streak/badges** (story seguinte 8.19), NÃO faz **admin UI** (8.9). É o único
> acoplamento permitido pela Constituição IV: features **emitem**, o lead score **consome**.

## Clarifications

### Session 2026-07-03

- Q: O score é por lead global ou por (lead, evento)? → A: **Por (lead, evento)** — cada evento
  (lançamento) tem o seu score, somado a partir dos eventos de engajamento daquele lead **naquele**
  evento.
- Q: O score é calculado on-demand ou persistido? → A: **On-demand / derivado** — somado no momento da
  leitura a partir dos eventos existentes; **sem** tabela de score persistida nem coluna materializada
  (evita dessincronia; recalcula sempre; muda quando novos eventos chegam).
- Q: Como os pesos por tipo de evento são definidos? → A: **Tabela fixa de pesos no código** (mapa
  `tipo → peso` versionado, ajustável por deploy); pesos configuráveis por base de dados ficam para
  evolução futura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calcular o score de engajamento de um lead (Priority: P1) 🎯 MVP

Quem opera o lançamento (ou uma automação de consumo) precisa saber **quão engajado** um lead está,
agora, para priorizar contato/personalização. O sistema devolve, para um lead de um evento, um **score
numérico** que soma o peso de cada evento de engajamento que ele já emitiu.

**Why this priority**: é o núcleo — sem calcular o score de um lead não há priorização. Sozinho já
entrega valor (saber quem está quente). Todo o resto (ranking, breakdown) deriva daqui.

**Independent Test**: para um lead com um conjunto conhecido de eventos, consultar o score e verificar
que é a **soma dos pesos** por tipo; adicionar um novo evento e verificar que o score **sobe** de acordo.

**Acceptance Scenarios**:

1. **Given** um lead com eventos de tipos com peso definido, **When** seu score é consultado, **Then**
   recebe a **soma dos pesos** desses eventos.
2. **Given** o mesmo lead recebe um novo evento de engajamento, **When** o score é consultado de novo,
   **Then** o score reflete o novo evento (recalculado no momento da leitura).
3. **Given** um lead **sem** eventos, **When** seu score é consultado, **Then** recebe **0**.
4. **Given** um lead com eventos de um tipo **sem peso definido**, **When** o score é consultado,
   **Then** esses eventos contribuem **0** (não quebram o cálculo).
5. **Given** o **mesmo** conjunto de eventos, **When** o score é consultado múltiplas vezes, **Then** o
   resultado é **sempre o mesmo** (determinístico).

---

### User Story 2 - Ranquear os leads de um evento por score (Priority: P2)

Para priorizar, o operador/automação precisa de uma **lista dos leads de um evento ordenada por score**
(do mais engajado para o menos), de modo a atacar primeiro os mais quentes.

**Why this priority**: transforma o score individual (US1) em ação de priorização em escala. Depende do
cálculo existir.

**Independent Test**: com vários leads de um evento com scores distintos, obter a lista e verificar que
vem **ordenada por score desc**, com o score de cada um.

**Acceptance Scenarios**:

1. **Given** um evento com vários leads de engajamentos diferentes, **When** a lista ranqueada é
   solicitada, **Then** vem **ordenada por score decrescente**.
2. **Given** dois leads com o mesmo score, **When** a lista é obtida, **Then** ambos aparecem (ordem de
   desempate estável e definida).
3. **Given** um evento sem leads, **When** a lista é solicitada, **Then** vem **vazia** (sem erro).

---

### User Story 3 - Transparência do score (breakdown por tipo) (Priority: P3)

Para confiar e ajustar a pontuação, quem consome precisa ver **como** o score foi formado — o
**detalhamento por tipo** (quantos eventos de cada tipo e quanto cada tipo contribuiu).

**Why this priority**: ajuda a calibrar pesos e a explicar a priorização, mas o valor central (score +
ranking) já existe sem ela.

**Independent Test**: para um lead com eventos de vários tipos, obter o breakdown e verificar que a
**soma das contribuições por tipo é igual ao score total**.

**Acceptance Scenarios**:

1. **Given** um lead com eventos de tipos variados, **When** o breakdown é solicitado, **Then** mostra,
   por tipo, a **contagem** e a **contribuição** (peso × contagem), e a **soma bate** com o score total.
2. **Given** um tipo sem peso, **When** aparece no breakdown, **Then** sua contribuição é **0** (mas a
   contagem pode ser exibida para transparência).

---

### Edge Cases

- **Lead inexistente / de outro evento**: consultar score de um lead que não pertence ao evento
  informado ⇒ resposta segura (score 0 ou não-encontrado, definido e consistente — ver Assumptions).
- **Tipo de evento novo sem peso**: contribui 0 até um peso ser adicionado (degradação segura; não
  quebra nem exige mudança para não travar).
- **Evento com muitos eventos de engajamento**: o cálculo continua correto e determinístico (a escala do
  piloto — milhares de leads — é suportada sem degradação perceptível).
- **Eventos duplicados/repetidos do mesmo tipo**: cada ocorrência conta (o peso é por ocorrência), salvo
  regra explícita em contrário (ver Assumptions).
- **Borda de consumo sem autorização**: consulta de score/ranking sem credencial de admin ⇒ **negada**.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST calcular o **score de um lead em um evento** como a **soma dos pesos** dos
  eventos de engajamento daquele lead naquele evento.
- **FR-002**: Os **pesos por tipo** MUST vir de uma **tabela fixa versionada**; um tipo **sem peso**
  definido MUST contribuir **0** (sem quebrar o cálculo).
- **FR-003**: O score MUST ser **derivado no momento da leitura** (sem valor persistido/materializado) e
  MUST **refletir** os eventos existentes naquele instante (muda quando novos eventos chegam).
- **FR-004**: O cálculo MUST ser **determinístico**: o mesmo conjunto de eventos MUST produzir sempre o
  mesmo score.
- **FR-005**: O sistema MUST permitir **listar os leads de um evento ordenados por score decrescente**,
  com desempate **estável e definido**.
- **FR-006**: O sistema MUST poder expor um **breakdown por tipo** (contagem e contribuição por tipo) cuja
  **soma** é igual ao score total.
- **FR-007**: As consultas de score/ranking/breakdown MUST ser expostas em uma **borda protegida por
  autorização de admin/consumo** (sem interface de admin nesta story).
- **FR-008**: Esta story MUST **apenas consumir** o contrato de eventos existente; MUST **não** emitir
  novos eventos nem adicionar tipo à taxonomia.
- **FR-009**: O sistema MUST **degradar de forma segura** para entradas anômalas (lead sem eventos, lead
  fora do evento, tipo sem peso) — sem erro e com resultado consistente.
- **FR-010**: O escopo MUST excluir **streak/badges** (8.19) e **admin UI** (8.9); esta story entrega
  **apenas** o cálculo/consulta do score.

### Key Entities *(include if feature involves data)*

- **Evento de engajamento**: registro existente (tipo + lead + evento + momento), fonte **única** do
  score. Reúso do contrato (CONTRIBUTING §3); sem alteração.
- **Peso por tipo**: valor numérico associado a cada tipo de evento na tabela fixa versionada
  (ex.: pesquisa/indicação altos; live/aula-concluída médios; abrir conteúdo/hub baixos). Tipo ausente ⇒ 0.
- **Score do lead (derivado)**: número por **(lead, evento)** = soma dos pesos dos eventos do lead;
  **não persistido**. Pode acompanhar um **breakdown por tipo**.
- **Lead**: participante do evento (reúso 8.1). Sem novo dado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para qualquer lead, o score retornado é **exatamente** a soma dos pesos dos seus eventos
  (verificável com conjuntos conhecidos).
- **SC-002**: Adicionar um evento com peso **P** a um lead aumenta o score dele em **exatamente P** na
  próxima leitura.
- **SC-003**: **100%** das leituras do mesmo conjunto de eventos retornam o **mesmo** score
  (determinismo).
- **SC-004**: A lista ranqueada de um evento está **100%** ordenada por score decrescente.
- **SC-005**: A **soma** das contribuições do breakdown é **igual** ao score total em **100%** dos casos.
- **SC-006**: **100%** das consultas sem autorização de admin/consumo são **negadas**.
- **SC-007**: Um tipo de evento **sem peso** definido nunca causa erro e contribui **0** em **100%** dos
  casos.

## Assumptions

- **Escopo do score** = por **(lead, evento)**; a fonte é `engagement_events` filtrado por lead + evento.
- **Cálculo on-demand**, sem persistência: a constituição pede derivados calculados na aplicação; evita
  dessincronia e job de atualização.
- **Peso por ocorrência**: cada evento conta uma vez (peso somado por ocorrência). Se, no futuro, algum
  tipo dever contar "uma vez por lead" (ex.: `survey.completed`), isso é ajuste de regra de peso — fora
  do escopo desta primeira versão, registrado como possível evolução.
- **Tabela de pesos inicial** (ajustável no plano/deploy, valores ilustrativos): pesquisa e indicação com
  peso alto; live assistida e aula concluída médios; abrir conteúdo, hub e início de aula baixos. Tipos
  não listados ⇒ 0.
- **Lead fora do evento / inexistente**: retorna score **0** (ou não-encontrado) de forma consistente;
  detalhe do formato definido no contrato do plano.
- **Autorização** por credencial de admin/consumo (padrão `X-Api-Key` das bordas de admin/ingestão), sem
  admin UI (8.9 traz UI). Consumidores externos (automação) também usam essa borda.
- **Sem tela nova**: é backend/consumo; mobile-first não se aplica.
- **Fronteira**: não implementa streak/badges (8.19) nem altera a emissão de eventos; apenas lê e soma.
