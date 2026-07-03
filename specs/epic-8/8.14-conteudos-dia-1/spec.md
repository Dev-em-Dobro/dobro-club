# Feature Specification: Conteúdos dia-1 (aulas de nivelamento + docs + acesso ao CodeQuest)

**Feature Branch**: `feat/8.14-conteudos-dia-1`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Conteúdos dia-1 do evento (pré-evento), acessíveis dentro do hub (8.12) e atrás do gate da pesquisa (8.2): aulas de nivelamento, docs/materiais (inclui docs com presentes) e um ponto de acesso ao CodeQuest (por ora só o link/rota, sem integração de progresso). Reusa sessão/magic link (8.1)."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.14 · **Trilho:** B — Crescimento & Conteúdo
> **Depende de:** 8.1 (sessão/magic link), 8.2 (pesquisa-gate), 8.12 (hub pré-evento)
> **Fronteira:** curadoria/entrega de presentes = 8.13; aulas do evento (semanal/20h) = 8.4

## Clarifications

### Session 2026-07-03

- Q: O ponto de acesso ao CodeQuest leva pra onde (ambiente único)? → A: **Link externo** — abre o
  CodeQuest fora da plataforma; é uma **exceção justificada** à Constituição III (CodeQuest é produto
  separado, não embedável nesta story), registrada como tradeoff.
- Q: Como o conteúdo dia-1 é liberado após o gate da pesquisa? → A: **Drip por data (agendado)** — cada
  item tem uma data de liberação; fica acessível quando o gate está satisfeito **e** a data chegou.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assistir às aulas de nivelamento no pré-evento (Priority: P1)

Um participante que já entrou no evento e respondeu à pesquisa acessa o hub e encontra **aulas de
nivelamento** — conteúdo que o prepara para o evento desde o dia 1. Ele consegue ver a lista de aulas
e assistir a uma delas **dentro da plataforma**, sem sair.

**Why this priority**: é o conteúdo de maior valor do período de aquecimento — dá ao participante um
motivo para voltar antes do evento e chega mais preparado. Sozinho já entrega valor.

**Independent Test**: com um lead autenticado que passou o gate, abrir o hub, ver a lista de aulas de
nivelamento e reproduzir uma aula; verificar que o acesso é registrado.

**Acceptance Scenarios**:

1. **Given** um lead que respondeu à pesquisa, **When** abre o hub, **Then** vê a lista de aulas de
   nivelamento disponíveis.
2. **Given** a lista de aulas, **When** abre uma aula, **Then** assiste ao conteúdo dentro da
   plataforma (sem redirecionar para fora) e o acesso é medido.
3. **Given** um lead que **não** respondeu à pesquisa, **When** tenta acessar as aulas, **Then** o
   conteúdo permanece bloqueado pelo gate (caminho para a pesquisa).
4. **Given** um lead que passou o gate e uma aula com **data de liberação futura**, **When** abre o
   hub, **Then** vê a aula como "em breve" com a data — e ela fica reproduzível só a partir dessa data.

---

### User Story 2 - Acessar docs e materiais (incl. docs com presentes) (Priority: P2)

O participante encontra no hub uma seção de **docs/materiais** — documentos e materiais de apoio,
incluindo os **docs que contêm presentes** — para leitura/consulta dentro do evento.

**Why this priority**: complementa o nivelamento com material de referência e é um gancho de valor
(presentes em doc), mas depende do hub/gate já existirem.

**Independent Test**: com um lead que passou o gate, abrir a seção de docs, abrir um doc (inclusive um
marcado como "presente") e verificar que o acesso é registrado.

**Acceptance Scenarios**:

1. **Given** um lead que passou o gate, **When** abre a seção de docs, **Then** vê os materiais
   disponíveis (incluindo docs com presentes).
2. **Given** a lista de docs, **When** abre um doc, **Then** consegue lê-lo/baixá-lo e o acesso é
   medido.

---

### User Story 3 - Ponto de acesso ao CodeQuest (Priority: P3)

O hub oferece um **ponto de acesso ao CodeQuest** (aulas/exercícios de código). Nesta story é apenas
o **acesso** — um cartão/rota que leva o participante ao CodeQuest — **sem** integração de progresso,
pontuação ou single sign-on.

**Why this priority**: garante a presença do CodeQuest no aquecimento com esforço mínimo; a integração
profunda (progresso/exercícios rastreados) fica para uma story futura.

**Independent Test**: com um lead que passou o gate, ver o cartão de acesso ao CodeQuest no hub e
acionar o acesso; verificar que o acionamento é registrado.

**Acceptance Scenarios**:

1. **Given** um lead que passou o gate (e a data de liberação chegou), **When** abre o hub, **Then**
   vê o ponto de acesso ao CodeQuest.
2. **Given** o ponto de acesso, **When** o aciona, **Then** o CodeQuest **abre fora da plataforma**
   (link externo) e o acionamento é medido.

---

### Edge Cases

- **Sem conteúdo cadastrado** de um tipo (nenhuma aula, nenhum doc): o hub degrada — não mostra seção
  vazia quebrada.
- **Item com data de liberação futura**: aparece como "em breve" com a data (gate satisfeito), sem
  permitir o acesso antes da hora.
- **Item sem data de liberação definida**: tratado como liberado (disponível assim que o gate passa),
  para não travar conteúdo por falta de agendamento.
- **Lead sem responder a pesquisa**: todo o conteúdo dia-1 permanece bloqueado (gate 8.2).
- **Sessão ausente/inválida**: conteúdo não é exibido; participante é levado ao acesso por magic link.
- **Conteúdo de outro evento**: um lead nunca vê conteúdo que não seja do seu evento.
- **Conteúdo indisponível/removido**: acessar um item que não existe mais retorna um estado tratado
  (sem quebra).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O hub MUST listar, para o lead autenticado, as **aulas de nivelamento** disponíveis do
  seu evento.
- **FR-002**: O participante MUST conseguir **assistir a uma aula de nivelamento dentro da
  plataforma**, sem ser redirecionado para fora.
- **FR-003**: O hub MUST listar **docs/materiais** do evento, incluindo os **docs marcados como
  presente**, permitindo leitura/consulta.
- **FR-004**: O hub MUST exibir um **ponto de acesso ao CodeQuest** que **abre o CodeQuest fora da
  plataforma** (link externo), **sem** rastrear progresso/pontuação. Esta é uma **exceção justificada**
  à Constituição III (ambiente único) — o CodeQuest é produto separado, não embedável nesta story.
- **FR-005**: Todo o conteúdo dia-1 MUST respeitar o **gate da pesquisa** (8.2): permanece bloqueado
  até o lead responder à pesquisa obrigatória.
- **FR-006**: A liberação do conteúdo dia-1 MUST ser **agendada por item (drip)**: cada item fica
  acessível quando **ambas** as condições valem — o gate da pesquisa está satisfeito **e** a **data de
  liberação** do item já chegou. É independente da janela de ingresso (T-3 dias).
- **FR-011**: Um item ainda **não liberado** (data futura) MUST ser exibido como **bloqueado com a
  data/indicação de "em breve"** (não simplesmente ocultado), para criar antecipação — desde que o
  gate já esteja satisfeito.
- **FR-007**: Cada acesso a conteúdo (aula, doc, CodeQuest) MUST ser **medido** (evento de
  engajamento), alimentando métricas e webhooks.
- **FR-008**: O conteúdo MUST ser acessível apenas com **sessão válida** (magic link, 8.1); um lead
  nunca vê conteúdo de outro evento.
- **FR-009**: As telas de conteúdo MUST ser **mobile-first** (validadas a 375–430px, toque ≥44px, sem
  layout shift).
- **FR-010**: Quando não houver conteúdo de um tipo, o hub MUST **degradar de forma segura** (ocultar
  ou indicar "em breve", sem seção quebrada).

### Key Entities *(include if feature involves data)*

- **Aula de nivelamento**: conteúdo de preparação pré-evento. Atributos conceituais: título,
  descrição, recurso de vídeo, ordem/sequência, **data de liberação (drip)**, evento. Distinta das
  aulas do evento (8.4), que seguem padrão semanal/20h.
- **Doc/Material**: documento ou material de apoio. Atributos: título, tipo, recurso (arquivo/link
  interno), indicador de **presente**, **data de liberação (drip)**, evento.
- **Ponto de acesso ao CodeQuest**: rótulo + **destino externo** (URL) do CodeQuest, com **data de
  liberação (drip)**. **Sem** entidade de progresso/pontuação nesta story.
- **Data de liberação (drip)** *(atributo transversal)*: momento a partir do qual um item fica
  acessível (combinado com o gate). Antes dela, o item aparece como "em breve" com a data.
- **Gate da pesquisa** *(reutilizado da 8.2/8.12)*: condição booleana "respondeu a pesquisa" que
  libera o conteúdo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um lead que passou o gate vê as três seções de conteúdo (aulas, docs, CodeQuest) no hub
  em **menos de 3 segundos** no celular.
- **SC-002**: **100%** do conteúdo dia-1 permanece bloqueado enquanto o lead não responde à pesquisa.
- **SC-003**: **100%** dos acessos a conteúdo (aula/doc/CodeQuest) geram um registro mensurável.
- **SC-004**: Pelo menos **X%** (meta a definir com o produto) dos leads que passam o gate acessam ao
  menos uma aula de nivelamento durante o pré-evento.
- **SC-005**: **100%** das tentativas de acesso sem sessão válida são impedidas de ver qualquer
  conteúdo.
- **SC-006**: **100%** dos itens com data de liberação futura permanecem inacessíveis até a data,
  mesmo com o gate já satisfeito; e ficam acessíveis a partir dela sem ação manual.

## Assumptions

- **Liberação drip por data** *(decidido — ver Clarifications)*: cada item tem data de liberação;
  fica acessível quando o gate está satisfeito **e** a data chegou. Item sem data ⇒ liberado ao passar
  o gate. Fuso/gatilho de liberação a detalhar no plano.
- **CodeQuest = link externo** *(decidido — ver Clarifications)*: apenas o ponto de acesso, que abre o
  CodeQuest **fora da plataforma**; integração de progresso, exercícios rastreados ou SSO ficam
  **fora** desta story. Exceção justificada à Constituição III.
- **Docs com presentes**: aqui são materiais estáticos disponibilizados; a **curadoria/entrega de
  presentes** (fluxo do mestre) é da **Story 8.13** — 8.14 só os expõe como docs.
- **Cadastro de conteúdo**: o conteúdo é provisionado por API/config, **sem** interface de admin nesta
  story (mesmo padrão da 8.4; admin é 8.9).
- **Nivelamento ≠ aulas do evento (8.4)**: nivelamento é pré-evento e não segue o padrão semanal/20h.
- **Reúso**: hub (8.12), gate da pesquisa (8.2) e sessão/magic link (8.1) são reaproveitados, não
  reimplementados.
- **Um evento de lançamento ativo por vez** (coerente com o Epic 8).
