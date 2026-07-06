# Feature Specification: Onboarding via ActiveCampaign (lead da captação entra logado)

**Feature Branch**: `feat/8.15-onboarding-activecampaign`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Porta de entrada do funil de aquecimento. O lead vem da captação (Meta →
página de captura → ActiveCampaign). A partir da AC, a plataforma precisa reconhecer esse lead e dar
acesso sem senha (magic link) para iniciar o aquecimento (nivelamento 8.14, atrás do gate 8.2).
Integração MÃO ÚNICA: AC → plataforma. Onboarding é o e-mail disparado pela própria AC com o magic
link (1 clique). Reusa a 8.1 (ingestão + magic link + webhook de inscrição), já em Next."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.15 · **Trilho:** B — Crescimento & Conteúdo
> **Depende de:** 8.1 (ingestão de lead + magic link + webhook de inscrição — **já portada em Next**)
> **Habilita:** entrada no funil → 8.12 (hub), 8.2 (gate da pesquisa), 8.14 (nivelamento)
> **Fronteira:** lead score (8.8), painel admin (8.9), gamificação e a **página de captura** (externa/Meta) ficam **fora**

## Clarifications

### Session 2026-07-03

- Q: Como o ActiveCampaign injeta o lead na plataforma? → A: **A automação da AC chama o endpoint de
  ingestão que já existe** (`POST /events/:id/leads`, auth `X-Api-Key`), mapeando os campos do contato.
  **Sem novo mecanismo de ingestão** — reúso direto da 8.1.
- Q: Como o magic link chega na AC para o e-mail de onboarding? → A: **Link personalizado (1 clique)**
  — a AC **consome o webhook de inscrição** (`lead.created`) e **guarda o `magicLink`**; o e-mail de
  onboarding da AC entrega o link, e o lead entra logado sem senha.
- Q: A plataforma escreve algo de volta na AC? → A: **Não** — a integração é **mão única**. Nenhuma
  tag/campo de pontuação é gravado na AC (lead score é a 8.8, story futura).
- Q: Quais contatos da AC viram lead na plataforma? → A: **Só os que entram numa lista/tag/estágio de
  qualificação do evento** — a automação da AC dispara a ingestão nesse ponto (não em todo contato
  criado). Isso controla o volume e já ancora o lead ao evento certo.
- Q: Como o onboarding chega a um contato sem email? → A: **MVP email-only.** A captação **sempre
  coleta nome, email e telefone**, então **email está sempre presente** e é a **identidade canônica**
  do onboarding. Entrega por WhatsApp para contatos sem email fica **fora** desta story.
- Q: Meta de tempo do SC-007 (contato qualificado → link disponível)? → A: **< 5 minutos** — ingestão
  + webhook são quase instantâneos do nosso lado; a folga absorve a automação/e-mail da AC.
- Q: Como medir a entrada via AC sem mexer na taxonomia FROZEN? → A: **Reusar o que já existe** —
  `lead.created` (8.1) + `source: "captacao-externa"` identificam a origem AC. **Sem** novo tipo de
  engajamento na taxonomia FROZEN nesta story.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lead da captação entra logado e cai no aquecimento (Priority: P1)

Uma pessoa se inscreve pela página de captura (anúncio no Meta) e vira contato no ActiveCampaign. A
partir daí, sem precisar se cadastrar de novo na plataforma, ela recebe um **e-mail de onboarding
(enviado pela AC)** com um **link pessoal**. Ao clicar, entra **logada, sem senha**, e cai no início
do aquecimento (hub do evento → pesquisa-gate → nivelamento).

**Why this priority**: é a **porta de entrada** de todo o funil — sem ela, nenhum lead da captação
chega ao conteúdo de aquecimento. Sozinha já entrega valor: transforma o contato da AC em participante
ativo dentro da plataforma.

**Independent Test**: simular a criação de um contato na AC → ele é registrado como lead do evento e um
**magic link pessoal** é exposto à AC (via webhook de inscrição); ao acessar por esse link, a pessoa
entra logada e é levada ao início do aquecimento (gate da pesquisa).

**Acceptance Scenarios**:

1. **Given** um contato que **entra na lista/tag de qualificação do evento** na AC (com email e/ou
   telefone), **When** a automação da AC aciona a ingestão do evento, **Then** o lead é registrado no
   evento e um **magic link pessoal** é devolvido/emitido para a AC guardar.
2. **Given** um lead registrado e o e-mail de onboarding da AC com o link pessoal, **When** a pessoa
   clica no link, **Then** ela entra **logada (sem senha)** e é levada ao início do aquecimento.
3. **Given** um lead que ainda **não** respondeu à pesquisa, **When** entra pelo link, **Then** cai no
   **gate da pesquisa** (8.2) e o conteúdo de aquecimento permanece bloqueado até responder.
4. **Given** um contato qualificado **com email** (padrão da captação: nome, email, telefone),
   **When** a ingestão ocorre, **Then** o **email é a identidade canônica** do lead e o e-mail de
   onboarding da AC entrega o link pessoal.

---

### User Story 2 - Reingestão idempotente (AC sincroniza sem duplicar) (Priority: P2)

O ActiveCampaign pode reenviar ou atualizar o mesmo contato várias vezes (re-sync, edição, automação
disparada de novo). A plataforma **não pode** criar um segundo lead nem gerar um novo link — o
participante mantém **a mesma identidade e o mesmo acesso**.

**Why this priority**: garante integridade da base e que o link já entregue continue válido; sem isso,
sincronizações da AC poluiriam a base e quebrariam links em circulação. Depende de US1 existir.

**Independent Test**: acionar a ingestão duas vezes para o mesmo contato (mesmo email/telefone) e
verificar que existe **um único** lead e **um único** magic link (o mesmo das duas vezes).

**Acceptance Scenarios**:

1. **Given** um lead já registrado, **When** a AC reenvia o mesmo contato (mesmo email ou telefone),
   **Then** nenhum segundo lead é criado e **o mesmo magic link** é retornado.
2. **Given** um contato atualizado na AC (ex.: corrige o telefone, mantém o email), **When** a ingestão
   ocorre, **Then** casa com o lead existente pela identidade e **não** duplica.

---

### User Story 3 - Provisionar e verificar a integração por evento (Priority: P3)

Quem opera o lançamento precisa **ligar** a AC ao evento: uma credencial de ingestão para a AC usar e
um destino para o webhook de inscrição (a URL que a AC escuta para receber o `magicLink`). Sem
interface de admin nesta story (config/API), como na 8.4/8.14.

**Why this priority**: é o que torna a integração real em produção, mas o comportamento de US1/US2 pode
ser testado sem a UI de provisionamento. Menor prioridade porque é operação, não jornada do
participante.

**Independent Test**: provisionar um evento com credencial de ingestão + destino de webhook, acionar um
contato de teste e confirmar que o `lead.created` (com `magicLink`) chega ao destino configurado.

**Acceptance Scenarios**:

1. **Given** um evento provisionado com credencial de ingestão e destino de webhook, **When** um lead é
   criado, **Then** o webhook `lead.created` (contendo o `magicLink`) é entregue ao destino da AC.
2. **Given** uma credencial de ingestão inválida, **When** a AC tenta ingerir, **Then** a chamada é
   rejeitada e **nenhum** lead é criado.

---

### Edge Cases

- **Contato sem email** (inesperado, fora do padrão da captação): não há entrega de onboarding nesta
  story (MVP email-only) — tratado como exceção, não como caminho feliz.
- **Contato sem email e sem telefone**: a ingestão é rejeitada (identidade mínima é email **ou**
  telefone).
- **Link revogado ainda armazenado na AC**: o clique cai numa tela amigável de "link inválido / pedir
  novo acesso" (revogação da 8.1 prevalece sobre o link guardado na AC).
- **Webhook para a AC falha** (AC fora do ar): a entrega é best-effort com retry; o `magicLink` também
  fica na **resposta** da ingestão, permitindo reconciliação — nenhum lead é perdido.
- **Contato de outro evento**: um lead nunca é associado a mais de um evento nem vê conteúdo de outro.
- **Reingestão fora de ordem / duplicada**: idempotente por email/telefone (nunca 2º lead, nunca 2º
  link).
- **Lead entra antes de responder a pesquisa**: cai no gate (8.2); comportamento esperado, não é erro.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Quando um contato **entra na lista/tag/estágio de qualificação do evento** no
  ActiveCampaign (não em todo contato criado), o sistema MUST registrar o **lead correspondente no
  evento reusando a ingestão existente (8.1)**, sem exigir novo cadastro do participante.
- **FR-002**: A ingestão MUST ser **idempotente por identidade** (email **ou** telefone): reenvios ou
  atualizações do mesmo contato NÃO criam um segundo lead nem geram um novo magic link.
- **FR-003**: Para cada lead registrado, o sistema MUST expor um **magic link pessoal reutilizável**
  (8.1) e **disponibilizá-lo à AC via o webhook de inscrição** (`lead.created`), para que o e-mail de
  onboarding entregue o link.
- **FR-004**: Ao acessar pelo magic link, o participante MUST entrar **logado, sem senha**, e ser
  levado ao **início do aquecimento** (hub 8.12 → gate da pesquisa 8.2 → nivelamento 8.14).
- **FR-005**: Um lead MUST estar sempre associado a **um único evento** e nunca acessar conteúdo de
  outro evento.
- **FR-006**: O sistema MUST permitir **provisionar a integração por evento** (credencial de ingestão +
  destino do webhook apontando para a automação da AC) **sem interface de admin** (config/API), no mesmo
  padrão da 8.4/8.14.
- **FR-007**: A captação sempre coleta email; portanto o lead vindo da AC MUST ter **email**, usado
  como **identidade canônica** do onboarding. Entrega do link por **WhatsApp** (contato sem email)
  fica **fora** desta story (MVP email-only).
- **FR-008**: Acesso **revogado** (8.1) MUST invalidar o magic link **mesmo que a AC ainda o tenha
  armazenado**.
- **FR-009**: A integração MUST ser **mão única**: o sistema **MUST NOT** escrever tags, campos ou
  pontuação de volta no ActiveCampaign (lead score e afins são stories futuras — 8.8).
- **FR-010**: A origem AC de um lead MUST ser mensurável **reusando sinais existentes** — o evento
  `lead.created` (8.1) e o `source: "captacao-externa"` do lead — **sem** adicionar um novo tipo à
  taxonomia de engajamento FROZEN nesta story.

### Key Entities *(include if data involved)*

- **Lead** *(reúso 8.1)*: participante do evento. Atributos: nome, email, telefone, **token/magic
  link**, evento, `source` (captação externa), estado de revogação. Identidade casada por email **ou**
  telefone.
- **Evento** *(reúso 8.1)*: contexto do lançamento. Atributos relevantes aqui: **credencial de
  ingestão** (para a AC chamar) e **destino do webhook** (URL que a AC escuta para receber o
  `magicLink`).
- **Contato da AC** *(externo)*: fonte da verdade da captação (Meta → captura → AC). É **mapeado** para
  um Lead na ingestão; não é persistido como entidade nova na plataforma.
- **Magic link** *(reúso 8.1)*: link pessoal, reutilizável e revogável, que dá acesso sem senha.
- **Webhook de inscrição `lead.created`** *(reúso 8.1)*: mensagem de saída que carrega o `magicLink`
  para a AC guardar e usar no e-mail de onboarding.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100%** dos contatos elegíveis criados na AC resultam em **um** lead no evento (sem
  duplicação), verificável por reconciliação.
- **SC-002**: **100%** dos e-mails de onboarding levam um link que faz o participante **entrar logado
  em 1 clique**, sem senha.
- **SC-003**: Reenvio/atualização do mesmo contato **nunca** gera um 2º lead nem um 2º magic link.
- **SC-004**: Do clique no link ao **início do aquecimento** (gate/nivelamento) em **menos de 3s** no
  celular.
- **SC-005**: **0** vazamentos entre eventos — um lead nunca acessa conteúdo de outro evento.
- **SC-006**: **Nenhuma** escrita de tag/campo de pontuação na AC (integração mão única), verificável.
- **SC-007**: O `magicLink` fica disponível ao lead (via webhook à AC) em **menos de 5 minutos** da
  qualificação do contato na AC.

## Assumptions

- **8.1 já portada e disponível em Next** (ingestão de lead, geração de magic link, entrada por token,
  webhook de inscrição, revogação): esta story **reúsa**, não reimplementa.
- **A AC é a fonte da captação** (Meta → página de captura → AC) e **roda as automações de e-mail** de
  onboarding — a **entrega** do e-mail é responsabilidade da AC.
- **A AC consegue** (a) **chamar** o endpoint de ingestão com a credencial do evento e (b)
  **consumir/guardar** o `magicLink` do webhook de inscrição para usar no e-mail. Configuração vive na
  AC (campo do contato para o link + automação de disparo).
- **Email é sempre coletado na captação** (formulário pede nome, email e telefone): é a **identidade
  canônica** do lead vindo da AC e o canal do onboarding. Coletar email dentro da plataforma **não** é
  necessário. Onboarding por WhatsApp (contato sem email) fica fora desta story.
- **Um evento de lançamento ativo por vez** (coerente com o Epic 8).
- **Fora de escopo**: lead score (8.8), painel/admin (8.9), gamificação, e a **página de captura**
  (externa/Meta) — não são construídos aqui.
