# Feature Specification: Nivelamento com liberação progressiva por lead (drip por tempo de entrada)

**Feature Branch**: `feat/8.16-nivelamento-progressivo`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Nivelamento com liberação progressiva por lead (drip por tempo relativo à entrada) — cada aula de nivelamento libera a cada 2-3 dias a partir da data em que o lead entrou, dando ritmo de aquecimento e motivo de voltar. Diferente do drip por data de calendário da 8.14."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.16 · **Trilho:** B — Crescimento & Conteúdo
> **Depende de:** 8.1 (sessão/magic link), 8.2 (pesquisa-gate), 8.12 (hub pré-evento), 8.14 (aulas de
> nivelamento no hub), 8.15 (onboarding/entrada do lead)
> **Fronteira:** NÃO substitui o drip **por data de calendário** da 8.14 (aquele permanece para docs e
> outros itens agendados). Esta story adiciona um **modo de liberação alternativo, por-lead**, aplicado
> às **aulas de nivelamento**. Lead score = 8.17 (futura); streak/badges = 8.18 (futura) — aqui só
> deixamos o acesso **mensurável**, sem calcular score nem streak.

## Clarifications

### Session 2026-07-03

- Q: Qual a âncora do "a cada 2-3 dias"? → A: **Data de entrada do lead** (quando o lead foi
  criado/entrou no evento). Cada lead começa da aula 1, independentemente de quando entrou no
  calendário.
- Q: A liberação exige assistir/concluir a aula anterior? → A: **Não** — é puramente por **tempo
  relativo à entrada**; concluir a anterior não adianta a próxima.
- Q: O intervalo é fixo ou por item? → A: **Configurável por item** — cada aula guarda seu **offset em
  dias** desde a entrada; há um default sensato quando o offset não é informado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aulas de nivelamento liberam no ritmo de cada participante (Priority: P1) 🎯 MVP

Um participante que entrou no evento (onboarding) e respondeu à pesquisa abre o hub e vê as **aulas de
nivelamento**. Em vez de todas de uma vez (ou presas a datas fixas do calendário), elas se **abrem
progressivamente a partir do dia em que ele entrou**: a primeira já disponível, as seguintes a cada
2-3 dias. Quem entrou hoje e quem entrou há uma semana estão em **pontos diferentes** da mesma trilha.

**Why this priority**: é o coração do aquecimento — dá cadência e um motivo recorrente de voltar, e
personaliza a jornada por lead sem depender de uma data global. Sozinha já entrega valor (ritmo +
retorno) e é o MVP da story.

**Independent Test**: com dois leads autenticados que passaram o gate, um com entrada "hoje" e outro
com entrada "há 5 dias", abrir o hub de cada um e verificar que veem **conjuntos diferentes** de aulas
liberadas conforme o tempo desde a própria entrada.

**Acceptance Scenarios**:

1. **Given** um lead que entrou hoje e passou o gate, **When** abre o hub, **Then** vê a **primeira**
   aula de nivelamento (offset 0) liberada e reproduzível.
2. **Given** o mesmo lead recém-entrado, **When** abre o hub, **Then** as aulas de offset maior
   aparecem como **"em breve"** com a **data prevista para ele** (entrada + offset), não reproduzíveis.
3. **Given** um lead que entrou há tempo suficiente para cruzar o offset de uma aula, **When** abre o
   hub, **Then** essa aula está **liberada** e reproduzível.
4. **Given** dois leads que entraram em dias diferentes, **When** ambos abrem o hub no mesmo momento,
   **Then** cada um vê a liberação calculada a partir da **sua própria** data de entrada (podem ver
   conjuntos diferentes).
5. **Given** um lead que **não** respondeu à pesquisa, **When** tenta acessar as aulas, **Then** o
   conteúdo permanece **bloqueado pelo gate** (a liberação progressiva só se aplica **depois** do gate).

---

### User Story 2 - Curadoria define o ritmo por aula (Priority: P2)

Quem opera o evento consegue definir, **por aula**, quantos dias após a entrada do lead ela deve abrir
(ex.: aula 1 = 0 dias, aula 2 = +2 dias, aula 3 = +5 dias), ajustando a cadência de aquecimento sem
tocar em código, e sem precisar de uma tela de admin (provisionamento por config/DB, como 8.4/8.14).

**Why this priority**: sem controle de curadoria a cadência vira número mágico no código; o produto
precisa ajustar o ritmo (2 vs 3 dias) conforme observa engajamento. Depende de US1 existir.

**Independent Test**: provisionar uma aula com offset explícito e outra sem offset; verificar que a
primeira libera exatamente no `entrada + offset` do lead e a segunda usa o **default** definido.

**Acceptance Scenarios**:

1. **Given** uma aula provisionada com offset de N dias, **When** um lead cuja entrada + N dias já
   passou abre o hub, **Then** a aula está liberada; **When** ainda não passou, **Then** aparece como
   "em breve" na data `entrada + N`.
2. **Given** uma aula provisionada **sem** offset, **When** avaliada para qualquer lead, **Then** usa o
   **valor default** de offset (comportamento previsível e documentado).
3. **Given** o offset de uma aula é alterado no provisionamento, **When** o lead reabre o hub, **Then**
   a liberação reflete o **novo** offset (cálculo sempre no momento da leitura, sem estado congelado).

---

### User Story 3 - Acesso mensurável para alimentar aquecimento futuro (Priority: P3)

Cada vez que um participante abre uma aula de nivelamento liberada, esse acesso é **registrado** (com a
identidade do lead, a aula e o momento), de modo que stories futuras (lead score 8.17, streak/badges
8.18) possam consumir esse sinal sem que esta story precise calcular pontuação ou sequência.

**Why this priority**: "Tudo é Mensurado" é não-negociável, mas a medição do acesso a aula **já existe**
na 8.14 (`content.opened`); aqui é sobretudo garantir que o novo modo de liberação **não quebra** essa
medição e que o sinal fica disponível para os consumidores futuros. Menor prioridade porque reúsa o que
já há.

**Independent Test**: um lead abre uma aula de nivelamento liberada e verifica-se que um registro de
acesso mensurável foi produzido, contendo lead, aula e horário; abrir uma aula **não** liberada não
produz acesso (fica bloqueada antes).

**Acceptance Scenarios**:

1. **Given** um lead com uma aula liberada, **When** ele a abre, **Then** um evento de engajamento de
   abertura de conteúdo é emitido (reúso da taxonomia existente `content.opened`).
2. **Given** um lead com uma aula ainda **não** liberada (em breve), **When** tenta abrir, **Then** o
   acesso é **negado** e **nenhum** evento de abertura é emitido para aquela aula.
3. **Given** os acessos registrados, **When** um consumidor futuro (score/streak) os lê, **Then**
   encontra lead, aula e horário suficientes para computar cadência/engajamento — sem que esta story
   compute score ou streak.

---

### Edge Cases

- **Lead sem data de entrada** (`created_at` ausente/inválida): a liberação progressiva não pode travar
  todo o nivelamento por dado ruim. O sistema MUST degradar de forma segura — tratar como **entrada
  "agora"** ou liberar apenas a aula de offset 0 — de modo previsível e documentado (ver Assumptions).
- **Offset inválido/negativo/ausente** em uma aula: MUST cair no **default** (não travar a aula nem
  liberar tudo por engano).
- **Relógio/borda do dia**: a comparação é por instante (`now >= entrada + offset`), não por "virada de
  meia-noite"; um lead que entrou às 23h não deve ver comportamento surpreendente na aula de offset 0.
- **Aula de nivelamento com data de calendário (`releaseAt`) herdada da 8.14** também definida: é preciso
  uma regra clara de qual condição vale para aulas de nivelamento (ver Assumptions — modo por-lead
  **prevalece** para `kind='lesson'`; itens de outros tipos seguem o drip por data).
- **Gate da pesquisa não satisfeito**: nada de nivelamento aparece liberado, independentemente do tempo
  de entrada — o gate vem **antes** da liberação progressiva.
- **Lead que entrou "no futuro"** (data de entrada à frente de `now`, por dado inconsistente): nenhuma
  aula com offset ≥ 0 deve liberar antes da hora; degradar sem erro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: As **aulas de nivelamento** MUST liberar **por lead**, com base na **data de entrada do
  lead** no evento: uma aula está liberada quando o momento atual é **≥ data de entrada do lead + offset
  da aula**.
- **FR-002**: Cada aula de nivelamento MUST ter um **offset em dias** configurável **por item**; quando
  ausente/ inválido, MUST usar um **valor default** previsível.
- **FR-003**: A liberação progressiva MUST **não** exigir conclusão/abertura da aula anterior — é
  **exclusivamente por tempo** relativo à entrada.
- **FR-004**: Uma aula ainda **não liberada** para o lead MUST ser exibida como **"em breve"** com a
  **data prevista específica daquele lead** (entrada + offset), e **não** pode ser reproduzida.
- **FR-005**: A liberação MUST ser calculada **no momento da leitura** (por lead, por requisição), sem
  congelar estado — refletindo alterações de offset e a passagem do tempo.
- **FR-006**: Toda a liberação progressiva MUST ocorrer **depois** do **gate da pesquisa** (8.2): sem o
  gate satisfeito, nenhuma aula de nivelamento aparece liberada.
- **FR-007**: O conteúdo MUST ser acessível apenas com **sessão válida** (magic link, 8.1); sem sessão
  não se vê nem calcula liberação.
- **FR-008**: O acesso a uma aula liberada MUST continuar **mensurável** via a taxonomia de engajamento
  existente (`content.opened` da 8.14) — sem novo tipo de evento na taxonomia FROZEN.
- **FR-009**: Tentar acessar uma aula **não liberada** para o lead MUST ser **negado** e **não** emitir
  evento de abertura para aquela aula.
- **FR-010**: A relação entre o **modo por-lead** (esta story) e o **drip por data de calendário** (8.14)
  MUST ser determinística: para `kind='lesson'`, o **modo por-lead prevalece**; itens de outros tipos
  (docs, CodeQuest) seguem inalterados o drip por data da 8.14.
- **FR-011**: O provisionamento do offset por aula MUST ser possível **por config/DB, sem admin UI**
  (mesmo padrão da 8.4/8.14/8.15), protegido por `X-Api-Key` nas bordas de ingestão/admin.
- **FR-012**: As telas afetadas MUST permanecer **mobile-first** (375–430px, toque ≥44px, sem layout
  shift), reusando a superfície de hub de conteúdo existente (sem tela nova).
- **FR-013**: O sistema MUST **degradar de forma segura** para dados ruins (entrada ausente/inválida,
  offset inválido) — nunca travando todo o nivelamento nem liberando tudo por engano (ver Assumptions).

### Key Entities *(include if feature involves data)*

- **Aula de nivelamento**: item de conteúdo do tipo aula (reúso do modelo `content_items`,
  `kind='lesson'` da 8.14). Ganha o atributo de **offset de liberação em dias** (relativo à entrada do
  lead). Demais atributos (título, recurso/embed, posição) permanecem os da 8.14.
- **Lead**: participante do evento; sua **data de entrada** (quando entrou/foi criado, 8.15/8.1) é a
  **âncora** do cálculo de liberação. Reúso do lead existente — sem novo dado além do já persistido.
- **Acesso a conteúdo (evento de engajamento)**: registro mensurável de abertura de aula (reúso
  `content.opened`, 8.14); insumo para consumidores futuros (score 8.17, streak 8.18).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dois leads com **datas de entrada diferentes**, avaliados no **mesmo** momento, veem
  conjuntos de aulas liberadas **coerentes com o tempo desde a própria entrada** (personalização por
  lead comprovada).
- **SC-002**: **100%** das aulas de nivelamento com `entrada + offset` no futuro permanecem
  **inacessíveis** ao lead até o momento previsto, exibidas como "em breve" com a data correta daquele
  lead.
- **SC-003**: **100%** do nivelamento permanece bloqueado enquanto o lead **não** passa o gate da
  pesquisa, independentemente do tempo de entrada.
- **SC-004**: **100%** das aberturas de aula liberada geram um registro mensurável (lead, aula,
  horário); **0%** das tentativas em aula não liberada geram registro de abertura.
- **SC-005**: **100%** dos casos de dado ruim (entrada ausente/inválida, offset ausente/inválido) são
  tratados sem erro e sem travar/abrir indevidamente todo o nivelamento (comportamento default
  observável).
- **SC-006**: A cadência de liberação (ex.: 2-3 dias entre aulas) é **ajustável por aula** e uma mudança
  de offset reflete na próxima leitura do hub, sem redeploy de código.

## Assumptions

- **Âncora de entrada** = `created_at` do lead (data em que entrou/foi criado no evento, 8.1/8.15).
  Quando ausente/inválida, assume-se **entrada = agora** (degradação segura: o lead começa a trilha do
  zero em vez de ficar travado).
- **Default de offset**: uma aula sem offset explícito usa **0 dias** (libera assim que passa o gate),
  para não prender conteúdo por falta de configuração; a curadoria define offsets crescentes (ex.: 0, 2,
  5) para obter a cadência de 2-3 dias. Valor default confirmável no plano.
- **Precedência sobre a 8.14**: para `kind='lesson'`, a liberação **por-lead prevalece** sobre o
  `releaseAt` por calendário da 8.14; a 8.14 continua valendo para **docs/CodeQuest** e para itens que
  não sejam aula. (Não removemos a coluna/lógica de calendário — apenas ela não governa aulas.)
- **Sem tela nova**: reúsa o hub de conteúdo já existente (8.12/8.14); a única diferença visível é
  **qual** aula está liberada/"em breve" e **a data prevista por lead**.
- **Escopo desta story**: apenas liberação por-lead + mensurabilidade do acesso. **Não** inclui cálculo
  de lead score (8.17), streak/badges (8.18), nem as lives de aquecimento mockadas (story própria).
- **Provisionamento** por config/DB (sem admin UI, 8.9 é quem trará admin); bordas de ingestão/admin
  protegidas por `X-Api-Key`.
- **Fuso/tempo**: comparação por instante em UTC (`now >= entrada + offset*dia`); apresentação da data
  "prevista" pode ser formatada na camada de UI.
