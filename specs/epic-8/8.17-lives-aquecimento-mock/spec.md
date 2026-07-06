# Feature Specification: Lives de aquecimento (mockadas) com agenda e medição de engajamento

**Feature Branch**: `feat/8.17-lives-aquecimento-mock`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Criar um lugar com arquivos mockados simulando as lives de aquecimento (pré-evento), pra já começar a medir o engajamento. Cada live tem agenda (data/hora) e estados: em breve → ao vivo agora → gravação disponível."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.17 · **Trilho:** B — Crescimento & Conteúdo
> **Depende de:** 8.1 (sessão/magic link), 8.2 (pesquisa-gate), 8.12 (hub pré-evento)
> **Fronteira:** NÃO é a aula do evento (semanal/20h) = 8.4. Esta story são as **lives de aquecimento
> pré-evento**, agora **mockadas** (placeholder), para começar a **medir engajamento**. A integração de
> streaming real e a captação da presença ao vivo são **evolução futura** (mesma tabela). Lead score e
> streak/badges consomem o sinal em **stories seguintes** — aqui só deixamos o engajamento **mensurável**.

## Clarifications

### Session 2026-07-03

- Q: As lives reusam `content_items` ou têm modelo próprio? → A: **Modelo próprio** (entidade `lives`
  separada), com ciclo de vida próprio (agenda + estados), sem sobrecarregar o conteúdo dia-1.
- Q: As lives mockadas precisam de agenda/estados ou são itens estáticos? → A: **Com agenda + estados**:
  cada live tem data/hora e deriva **agendada (em breve) → ao vivo agora → gravação disponível**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver a agenda de lives de aquecimento e seu estado (Priority: P1) 🎯 MVP

Um participante que entrou no evento e respondeu à pesquisa abre o hub e encontra uma seção **Lives de
aquecimento** com a agenda: cada live aparece com **título, data/hora** e um **estado** que muda sozinho
com o tempo — **"em breve"** antes de começar, **"ao vivo agora"** durante a janela, e **"gravação
disponível"** depois. Mesmo mockadas, elas dão ao participante um calendário e um motivo de voltar.

**Why this priority**: é o núcleo — sem a agenda com estados não há "lives de aquecimento". Sozinha já
entrega valor (o participante vê o que vem e quando) e é o que torna o engajamento observável.

**Independent Test**: com um lead autenticado que passou o gate, seedar três lives mockadas (uma no
futuro, uma na janela "agora", uma no passado com gravação) e verificar que o hub mostra os três estados
corretos e que eles mudam conforme o horário.

**Acceptance Scenarios**:

1. **Given** um lead que passou o gate e uma live **agendada para o futuro**, **When** abre o hub,
   **Then** vê a live como **"em breve"** com a data/hora, sem poder assistir ainda.
2. **Given** uma live cuja **janela ao vivo** contém o momento atual, **When** abre o hub, **Then** vê a
   live como **"ao vivo agora"** e consegue entrar/assistir.
3. **Given** uma live cuja janela **já passou** e que tem **gravação**, **When** abre o hub, **Then** vê
   **"gravação disponível"** e consegue assistir à gravação.
4. **Given** uma live cuja janela já passou e que **não** tem gravação, **When** abre o hub, **Then** vê
   um estado de **encerrada** (sem link para assistir).
5. **Given** um lead que **não** respondeu à pesquisa, **When** tenta acessar as lives, **Then** a seção
   permanece **bloqueada pelo gate** (caminho para a pesquisa).

---

### User Story 2 - Assistir (ou entrar) e ter o acesso medido (Priority: P2)

Quando a live está **ao vivo** ou como **gravação**, o participante consegue **assistir dentro da
plataforma** (sem sair), e esse acesso é **registrado** — para que o engajamento com as lives comece a
ser medido desde já, alimentando lead score e streak em stories seguintes.

**Why this priority**: medir o engajamento é o objetivo declarado ("pra já começar a medir"); depende de
a agenda/estado existir (US1). É o que transforma a live mockada em sinal útil.

**Independent Test**: com uma live "ao vivo" (ou "gravação"), abrir/entrar e verificar que um registro de
acesso mensurável é produzido com o lead, a live e o momento; tentar assistir a uma live "em breve" não
produz acesso.

**Acceptance Scenarios**:

1. **Given** uma live **ao vivo** e um lead que passou o gate, **When** ele entra/assiste, **Then**
   assiste **dentro da plataforma** e o acesso é **medido**.
2. **Given** uma live como **gravação disponível**, **When** o lead assiste, **Then** assiste dentro da
   plataforma e o acesso é **medido**.
3. **Given** uma live **"em breve"** (ainda não começou), **When** o lead tenta assistir, **Then** o
   acesso é **negado** e **nenhum** registro de acesso é produzido.
4. **Given** um lead **sem sessão válida**, **When** tenta assistir, **Then** o acesso é impedido.

---

### User Story 3 - Provisionar/curar a agenda de lives (Priority: P3)

Quem opera o evento consegue **cadastrar/ajustar** as lives mockadas (título, data/hora, duração, link da
transmissão e link da gravação) por **config/DB**, sem tela de admin (padrão 8.4/8.14/8.15), para montar
a agenda de aquecimento e, no futuro, trocar o mock pelo streaming real na mesma estrutura.

**Why this priority**: sem provisionamento a agenda vira dado fixo no código; o produto precisa montar e
ajustar as datas. Menor prioridade porque é operação, não experiência do participante.

**Independent Test**: provisionar uma live com data/hora e links; verificar que ela aparece na agenda com
o estado correto para o horário e que a borda de provisionamento é protegida.

**Acceptance Scenarios**:

1. **Given** uma chamada de provisionamento **autorizada** com os dados da live, **When** executada,
   **Then** a live passa a aparecer na agenda com o estado derivado do horário.
2. **Given** uma chamada de provisionamento **sem autorização**, **When** executada, **Then** é
   **recusada** e nenhuma live é criada.
3. **Given** uma live provisionada **sem gravação**, **When** sua janela passa, **Then** ela aparece como
   **encerrada** (não "gravação disponível").

---

### Edge Cases

- **Live sem data/hora** (dado ruim): a agenda não pode quebrar. O sistema MUST degradar de forma segura
  — tratar como estado indefinido/"em breve" sem link, sem travar a seção inteira (ver Assumptions).
- **Duração ausente**: sem fim de janela definido, MUST usar uma **duração default** para derivar o fim
  do "ao vivo" (ver Assumptions).
- **Gravação ausente após a janela**: estado **encerrada**, sem link — nunca "gravação disponível".
- **Fuso/borda da janela**: a transição em breve→ao vivo→gravação é por **instante** (início e fim da
  janela), não por virada de dia.
- **Assistir fora do estado permitido** (ex.: "em breve"): acesso **negado**, **sem** registro de acesso.
- **Gate da pesquisa não satisfeito**: a seção de lives inteira permanece bloqueada, independentemente do
  estado das lives.
- **Sem lives cadastradas**: a seção **degrada de forma segura** (ocultar ou "em breve"), sem erro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O hub MUST exibir, para o lead autenticado que passou o gate, uma seção **Lives de
  aquecimento** listando as lives com **título e data/hora**.
- **FR-002**: Cada live MUST ter um **estado derivado do horário atual**: **agendada ("em breve")** antes
  do início; **ao vivo ("ao vivo agora")** dentro da janela [início, fim]; **gravação disponível** após a
  janela quando há gravação; **encerrada** após a janela quando **não** há gravação.
- **FR-003**: O estado MUST ser calculado **no momento da leitura** (sem estado congelado), refletindo a
  passagem do tempo e mudanças de agenda.
- **FR-004**: O participante MUST conseguir **assistir dentro da plataforma** (sem redirecionar para fora)
  quando a live está **ao vivo** (transmissão) ou como **gravação disponível** (gravação).
- **FR-005**: Tentar assistir a uma live que **não** está em estado assistível (ex.: "em breve",
  "encerrada") MUST ser **negado**.
- **FR-006**: Todo acesso a uma live assistível (entrar ao vivo / abrir gravação) MUST ser **medido**
  (registro de engajamento com lead, live e momento), para alimentar lead score/streak em stories
  seguintes.
- **FR-007**: A seção e o acesso às lives MUST respeitar o **gate da pesquisa** (8.2): bloqueados até o
  lead responder.
- **FR-008**: As lives MUST ser acessíveis apenas com **sessão válida** (magic link, 8.1).
- **FR-009**: A agenda de lives MUST ser **provisionável por config/DB, sem admin UI** (padrão
  8.4/8.14/8.15), com a borda de provisionamento **protegida por autorização de admin**.
- **FR-010**: Cada live MUST guardar **data/hora de início, duração (ou fim), link da transmissão e link
  da gravação** (transmissão/gravação podem estar vazios enquanto mock/pendente).
- **FR-011**: A seção de lives MUST ser **mobile-first** (375–430px, toque ≥44px, sem layout shift),
  integrada ao hub existente.
- **FR-012**: O sistema MUST **degradar de forma segura** quando não houver lives ou quando houver dado
  ruim (sem data, sem duração, sem gravação) — sem travar a seção nem quebrar o hub.
- **FR-013**: As lives desta story são **mockadas/placeholder**; a estrutura MUST permitir **trocar o mock
  pelo streaming/gravação reais** depois **sem** novo modelo de dados.

### Key Entities *(include if feature involves data)*

- **Live de aquecimento**: evento ao vivo pré-evento. Atributos: título, descrição, **início
  (data/hora)**, **duração/fim**, **link da transmissão** (assistir ao vivo), **link da gravação**
  (assistir depois), posição/ordem. Modelo **próprio** (separado do conteúdo dia-1 da 8.14). Estado
  (em breve / ao vivo / gravação / encerrada) é **derivado** do horário — não persistido.
- **Acesso à live (registro de engajamento)**: registro mensurável de entrar/assistir a uma live
  assistível (lead, live, momento). Insumo para lead score e streak/badges (stories seguintes).
- **Lead**: participante com sessão válida (8.1) e gate de pesquisa satisfeito (8.2). Reúso — sem novo
  dado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100%** das lives exibem o estado correto (em breve / ao vivo / gravação / encerrada) para
  o horário atual, e o estado muda sozinho ao cruzar início e fim da janela.
- **SC-002**: **100%** das tentativas de assistir a uma live **não** assistível (em breve/encerrada) são
  negadas e **não** geram registro de acesso.
- **SC-003**: **100%** dos acessos a lives assistíveis (ao vivo/gravação) geram um registro mensurável
  (lead, live, momento).
- **SC-004**: **100%** da seção de lives permanece bloqueada enquanto o lead não passa o gate da pesquisa.
- **SC-005**: **100%** das tentativas de acesso sem sessão válida são impedidas.
- **SC-006**: A agenda é **provisionável** por operação autorizada; **0%** das tentativas não autorizadas
  criam lives.
- **SC-007**: **100%** dos casos de dado ruim (sem data/sem duração/sem gravação) são tratados sem erro e
  sem travar a seção (estado seguro observável).

## Assumptions

- **Estado derivado, não persistido**: calculado a cada leitura a partir de início + duração + agora
  (consistente com o drip da 8.14/8.16). "Ao vivo" = agora ∈ [início, início+duração].
- **Duração default**: quando a duração não é informada, assume-se um valor padrão (ex.: 90 min) para
  fechar a janela do "ao vivo"; confirmável no plano.
- **Dado ruim de data**: live sem início válido ⇒ estado seguro "em breve"/indefinido, sem link, sem
  travar a seção.
- **Mock**: nesta story os links de transmissão/gravação são **placeholder** (podem estar vazios); a
  troca pelo conteúdo real é evolução futura na **mesma** entidade (FR-013).
- **Medição**: reúsa o mecanismo de engajamento existente (eventos → métricas → webhook, Const. IV); o
  **tipo/nome exato** do evento de acesso à live é decidido no plano (reuso vs. novo tipo, respeitando a
  taxonomia). O importante para a spec é que **o acesso é medido**.
- **Assistir dentro da plataforma**: transmissão/gravação são exibidas via embed no ambiente (Const. III),
  como as aulas — sem redirecionar para fora.
- **Provisionamento** por config/DB sem admin UI (admin é 8.9); borda protegida por autorização de admin.
- **Fronteira**: não inclui streaming real, presença/tempo-assistido detalhado, lead score nem
  streak/badges — cada um é story própria seguinte.
- **Numeração**: esta é a 8.17; lead score e streak/badges vêm **depois** (referências de número em specs
  anteriores são indicativas e podem deslocar).
