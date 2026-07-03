# Feature Specification: Acesso pré-ingresso (credencial provisória + hub do evento)

**Feature Branch**: `feat/8.12-acesso-pre-ingresso`

**Created**: 2026-07-02

**Status**: Draft

**Input**: User description: "Fluxo do participante que entrou no evento desde o dia 1 mas ainda não tem ingresso (o ingresso só existe 3 dias antes do evento começar). Ele precisa de uma forma de acessar o evento e o conteúdo antes disso, via uma credencial provisória que depois vira o ingresso oficial. O conteúdo do evento fica atrás do gate da pesquisa."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.12 · **Trilho:** B — Crescimento & Conteúdo
> **Depende de:** 8.1 (magic link/sessão), 8.2 (pesquisa-gate), 8.3 (ingresso — ponto de convergência)
> **Habilita:** 8.13 (entrega de presentes), 8.14 (conteúdos dia-1)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar no evento antes do ingresso via credencial provisória (Priority: P1)

Um participante que se inscreveu no início da captação abre a plataforma **dias antes** de o
ingresso oficial existir (o ingresso só é liberado 3 dias antes do evento começar). Em vez de uma
tela vazia ou um "volte depois", ele entra logado (magic link) e recebe uma **credencial
provisória** — uma versão de "pré-evento" com a identidade do evento e seus dados — e cai num
**hub/home do evento** que dá sentido à espera e concentra o que já está disponível.

**Why this priority**: É o núcleo da feature e o único que, sozinho, já entrega valor: transforma o
período morto entre inscrição e ingresso em presença ativa dentro da plataforma. Sem isto, o
participante inscrito não tem para onde ir antes do ingresso.

**Independent Test**: Autenticar um lead existente, acessar o hub antes da janela de ingresso e
verificar que (a) uma credencial provisória é exibida com os dados do participante e a identidade do
evento, e (b) o hub carrega com a navegação do evento. Entrega valor mesmo sem os demais stories.

**Acceptance Scenarios**:

1. **Given** um lead autenticado cujo evento ainda não abriu a janela de ingresso, **When** ele
   acessa o hub, **Then** vê sua credencial provisória (identidade do evento + seus dados) e a home
   do evento.
2. **Given** um lead que já possui credencial provisória, **When** ele volta ao hub, **Then** a
   mesma credencial é exibida (sem duplicar/gerar outra).
3. **Given** um visitante sem sessão válida, **When** tenta abrir o hub, **Then** é levado ao fluxo
   de acesso por magic link (nunca vê o hub de outro lead).

---

### User Story 2 - Credencial provisória converge para o ingresso oficial (Priority: P2)

Quando faltam 3 dias para o evento, a janela de ingresso abre. O participante que já tinha a
credencial provisória **não precisa se cadastrar de novo**: sua credencial vira (ou passa a apontar
para) o **ingresso oficial** da Story 8.3, preservando indicação/atribuição e continuidade.

**Why this priority**: Garante que o esforço de captação antecipada não se perca na virada e que a
transição seja invisível para o participante. Depende de US1 já existir.

**Independent Test**: Com um lead que possui credencial provisória, simular a abertura da janela
(evento a ≤3 dias do início) e verificar que o ingresso oficial fica disponível para o mesmo lead
sem novo cadastro e sem perder a atribuição de indicação.

**Acceptance Scenarios**:

1. **Given** um lead com credencial provisória, **When** a janela de ingresso abre (T-3 dias),
   **Then** o ingresso oficial fica disponível para ele sem exigir novo cadastro.
2. **Given** um lead que entra pela primeira vez **já dentro** da janela de ingresso, **When**
   acessa o evento, **Then** recebe diretamente o ingresso oficial (não uma credencial provisória).
3. **Given** um lead cuja credencial já convergiu, **When** volta ao hub, **Then** vê o ingresso
   oficial no lugar da credencial provisória.

---

### User Story 3 - Hub respeita o gate da pesquisa (Priority: P3)

O conteúdo do evento dentro do hub só é liberado depois que o participante responde à pesquisa
obrigatória (Story 8.2). Antes disso, o hub mostra a credencial e conduz o participante à pesquisa;
o conteúdo aparece bloqueado.

**Why this priority**: Reforça a regra de gate já definida na 8.2 dentro da nova superfície, mas o
acesso e a credencial (US1) têm valor mesmo antes de o conteúdo existir.

**Independent Test**: Com um lead que ainda não respondeu à pesquisa, abrir o hub e verificar que o
conteúdo está bloqueado e há um caminho claro para a pesquisa; após responder, verificar que o
bloqueio é liberado.

**Acceptance Scenarios**:

1. **Given** um lead que não respondeu à pesquisa, **When** abre o hub, **Then** o conteúdo do
   evento aparece bloqueado com um caminho para responder a pesquisa.
2. **Given** um lead que acabou de responder à pesquisa, **When** retorna ao hub, **Then** o
   conteúdo deixa de estar bloqueado.

---

### Edge Cases

- **Virada da janela durante a sessão**: o participante está no hub no exato momento em que a janela
  de ingresso abre — o estado (credencial → ingresso) deve refletir na próxima visita/atualização
  sem erro.
- **Evento sem data de início definida**: a janela de ingresso não pode ser calculada — o hub deve
  degradar de forma segura (mantém credencial provisória, sem prometer data).
- **Lead que já tem ingresso oficial**: o hub mostra o ingresso, não a credencial provisória.
- **Lead sem responder a pesquisa por todo o pré-evento**: continua com acesso ao hub e à
  credencial, mas o conteúdo permanece bloqueado.
- **Retorno repetido / múltiplos dispositivos**: revisitar não gera credencial duplicada.
- **Visitante totalmente novo (sem lead)**: fora do escopo desta story capturar o lead — a criação
  inicial pertence a 8.1/8.3; aqui assume-se um lead já existente e autenticado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir que um lead autenticado acesse o hub do evento **antes** da
  abertura da janela de ingresso.
- **FR-002**: O sistema MUST gerar, na primeira entrada pré-evento, uma **credencial provisória**
  para o lead, exibindo a identidade do evento e os dados do participante.
- **FR-003**: A credencial provisória MUST ser **visualmente distinta** do ingresso oficial (estado
  "pré-evento/provisório"), para não confundir o participante.
- **FR-004**: A criação da credencial provisória MUST ser **idempotente** por lead/evento — revisitar
  ou acessar de outro dispositivo não pode gerar uma segunda credencial.
- **FR-005**: O hub MUST indicar ao participante **quando** o ingresso oficial será liberado (janela
  = 3 dias antes do início do evento), quando a data de início estiver definida.
- **FR-006**: Quando a janela de ingresso abrir (T-3 dias), o sistema MUST tornar o **ingresso
  oficial** disponível para o lead que possuía credencial provisória, **sem exigir novo cadastro** e
  **preservando a atribuição de indicação**.
- **FR-007**: Um lead que acesse o evento pela primeira vez **já dentro** da janela de ingresso MUST
  receber diretamente o ingresso oficial, não uma credencial provisória.
- **FR-008**: O hub MUST respeitar o **gate da pesquisa** (Story 8.2): o conteúdo do evento permanece
  bloqueado até o lead responder à pesquisa obrigatória.
- **FR-009**: O acesso MUST usar exclusivamente **magic link/sessão** (sem senha, sem cadastro
  interno), e o hub de um lead NUNCA pode ser exibido a outro.
- **FR-010**: Nenhum elemento do hub pode **redirecionar o participante para fora** da plataforma.
- **FR-011**: O sistema MUST **emitir evento de engajamento** quando o lead acessa o hub pré-evento,
  para alimentar métricas e webhooks.
- **FR-012**: O hub e a credencial provisória MUST ser **mobile-first** (validados a 375–430px, toque
  ≥44px, sem layout shift).

### Key Entities *(include if feature involves data)*

- **Credencial provisória**: representa o acesso de pré-evento de um lead a um evento. Atributos
  conceituais: participante (lead), evento, estado (`provisória` | `convertida`), momento de criação.
  Relaciona-se com o **Ingresso** (Story 8.3) — é o estado anterior que converge para ele na abertura
  da janela.
- **Hub do evento**: superfície agregadora de pré-evento por participante — reúne credencial,
  contagem para a janela de ingresso e a navegação/gate do conteúdo. Não possui conteúdo próprio
  (aulas, presentes e CodeQuest são das Stories 8.13/8.14).
- **Janela de ingresso**: período derivado da **data de início do evento** (abre em T-3 dias). Governa
  a transição credencial → ingresso e a mensagem de contagem no hub.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um lead autenticado consegue abrir o hub e ver sua credencial provisória em **menos de
  3 segundos** no celular.
- **SC-002**: **100%** dos leads com credencial provisória têm o ingresso oficial disponível
  **automaticamente** na abertura da janela, sem repetir cadastro e sem perder atribuição de
  indicação.
- **SC-003**: **Zero** credenciais provisórias duplicadas por lead/evento, mesmo com acessos
  repetidos ou multi-dispositivo.
- **SC-004**: Pelo menos **X%** (meta a definir com o produto) dos leads inscritos acessam o hub ao
  menos uma vez durante o período pré-evento.
- **SC-005**: **100%** das tentativas de acessar o hub sem sessão válida são impedidas de ver dados de
  qualquer lead.

## Assumptions

- **Lead já existe**: esta story assume um lead autenticado (criado na inscrição — Story 8.1). A
  captação de um visitante totalmente novo pertence a 8.1/8.3, não aqui.
- **Janela de ingresso = 3 dias antes do início do evento**, com a data de início vindo da
  configuração do evento; quando ausente, o hub degrada sem prometer data.
- **Convergência automática por tempo**: a transição credencial → ingresso ocorre pela abertura da
  janela, sem ação do participante.
- **Escopo de casca**: esta story entrega o **acesso, a credencial provisória e a casca do hub
  (navegação + gate)**. O conteúdo em si — aulas de nivelamento, docs, presentes e acesso ao CodeQuest
  — é das Stories 8.13 (presentes) e 8.14 (conteúdos dia-1).
- **Reúso**: o gate da pesquisa (8.2), a sessão/magic link (8.1) e o modelo de ingresso (8.3) são
  reaproveitados, não reimplementados.
- **Um evento de lançamento ativo por vez** (coerente com o restante do Epic 8).
