# Feature Specification: Ingresso/Credencial compartilhável com indicação por QR

**Feature Branch**: `feat/8.3-ingresso`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "O usuário gera seu ingresso/credencial do evento a partir de um template (Cloudinary) + avatar; o lead escolhe mandar a própria foto ou ficar com o avatar default. Para gerar precisa informar nome, e-mail e telefone (vira lead). Ao gerar recebe um magic link pessoal (individual, rastreável). O ingresso compartilhado traz um QR code público que leva outra pessoa a gerar o ingresso dela, atribuindo a indicação a quem compartilhou — fechando um ciclo viral."

## Clarifications

### Session 2026-07-01

- Q: Canal de entrega do link pessoal de acesso? → A: Tela dedicada exibe o magic link logo após a
  geração (+ envio por e-mail, reuso da 8.1). Se o participante esquecer, recupera informando o
  e-mail cadastrado. WhatsApp fica fora de escopo v1.
- Q: Na recuperação ("esqueci meu link"), como o link é devolvido? → A: Reenviado ao e-mail
  cadastrado (nunca exibido na tela para um e-mail digitado) — evita impersonação e vazamento de
  dado pessoal. Exibir na tela só é permitido logo após a geração (mesma sessão).
- Q: Chave de idempotência (o que conta como "mesma pessoa")? → A: E-mail **ou** telefone (qualquer
  um repetido = mesma pessoa), alinhado ao `createOrGetLead` já implementado na 8.1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar meu ingresso e entrar no evento (Priority: P1)

Um visitante chega à plataforma do evento (por link direto, anúncio ou QR de um amigo), informa
nome, e-mail e telefone, escolhe subir uma foto ou manter o avatar padrão, e recebe na hora um
ingresso personalizado bonito com a identidade do evento. No mesmo momento ele recebe um link
pessoal de acesso (por e-mail/WhatsApp) que o coloca dentro do evento sem senha.

**Why this priority**: É o gancho de conversão do evento — o ingresso *é* a inscrição. Sem ele não
há lead, não há acesso e não há nada para compartilhar. Entrega valor sozinho: transforma um
visitante anônimo em participante identificado com acesso ao evento.

**Independent Test**: Preencher nome/e-mail/telefone, escolher avatar padrão, e verificar que (a) um
ingresso com o nome da pessoa é exibido para download, e (b) um link pessoal de acesso é enviado e,
ao ser aberto, coloca a pessoa dentro do evento identificada.

**Acceptance Scenarios**:

1. **Given** um visitante na tela de geração de ingresso, **When** ele informa nome, e-mail e
   telefone válidos e mantém o avatar padrão, **Then** o sistema cria o participante, gera o
   ingresso com o nome dele e envia um link pessoal de acesso.
2. **Given** um visitante na tela de geração, **When** ele opta por enviar a própria foto, **Then**
   o ingresso é gerado com a foto no lugar do avatar padrão.
3. **Given** um participante que recebeu o link pessoal, **When** ele abre o link, **Then** entra no
   evento identificado como ele mesmo, sem precisar de senha.
4. **Given** um e-mail que já gerou ingresso antes, **When** a pessoa gera novamente, **Then** o
   sistema reaproveita o mesmo participante (não cria duplicata) e reentrega o acesso.

---

### User Story 2 - Compartilhar meu ingresso para divulgar o evento (Priority: P2)

Depois de gerar o ingresso, o participante pode baixá-lo como imagem e compartilhá-lo em redes
sociais e WhatsApp. O ingresso compartilhado carrega um QR code público que convida quem vê a gerar
o próprio ingresso — sem nunca dar acesso à conta de quem compartilhou.

**Why this priority**: É o motor de crescimento orgânico ("moeda social"). Depende da US1 existir,
mas entrega valor independente: mais alcance e mais inscrições sem custo de mídia.

**Independent Test**: Gerar um ingresso, acionar o compartilhamento, e verificar que (a) a imagem
baixada contém um QR code, (b) o QR leva à tela de geração de ingresso (e não à conta de quem
compartilhou), e (c) um evento de compartilhamento é registrado.

**Acceptance Scenarios**:

1. **Given** um participante com ingresso gerado, **When** ele aciona "baixar", **Then** recebe uma
   imagem do ingresso contendo um QR code público de convite.
2. **Given** um participante com ingresso gerado, **When** ele aciona "compartilhar" em um canal
   (rede/WhatsApp), **Then** o sistema registra um evento de compartilhamento com o canal usado.
3. **Given** o QR code do ingresso de um participante, **When** qualquer pessoa o escaneia, **Then**
   ela cai na tela pública de geração de ingresso e **não** entra logada como o dono do QR.

---

### User Story 3 - Chegar por indicação de um amigo e ter a indicação atribuída (Priority: P3)

Uma pessoa que escaneia o QR do ingresso de um amigo gera o próprio ingresso; o sistema registra que
ela veio por indicação daquele amigo, dando ao amigo o crédito da indicação. O ingresso da nova
pessoa nasce com o próprio QR, permitindo que o ciclo se repita.

**Why this priority**: Fecha o ciclo viral e alimenta a atribuição de indicações. A contabilização,
ranking e premiação de indicações são responsabilidade da Story 8.7; aqui garantimos apenas que a
origem (quem indicou quem) seja capturada corretamente no momento da geração.

**Independent Test**: Abrir a tela de geração a partir de um QR que carrega o identificador de um
participante existente, gerar um novo ingresso, e verificar que o novo participante fica associado
ao indicador e que o evento de indicação correspondente é disponibilizado.

**Acceptance Scenarios**:

1. **Given** a tela de geração aberta a partir do QR de um indicador válido, **When** um novo
   visitante gera seu ingresso, **Then** o novo participante fica registrado como indicado por aquele
   indicador.
2. **Given** um novo participante gerado por indicação, **When** o ingresso dele é criado, **Then**
   o QR do ingresso dele passa a carregar o identificador dele (e não o do indicador original).
3. **Given** uma origem de indicação que aponta para um indicador inexistente ou para o próprio
   visitante, **When** o ingresso é gerado, **Then** o participante é criado normalmente, porém sem
   atribuição de indicação (auto-indicação e indicador inválido são ignorados).

---

### Edge Cases

- **E-mail/telefone inválido ou ausente**: geração é bloqueada com mensagem clara; nenhum
  participante é criado.
- **Geração repetida (mesmo e-mail ou telefone)**: idempotente — reaproveita o participante
  existente e reentrega o acesso, sem criar lead duplicado nem novo identificador de indicação.
- **Foto enviada pelo participante**: aceita sem etapa de moderação — decisão de negócio baseada em
  ~1 ano operando o mesmo fluxo de ingresso sem incidentes. A foto é responsabilidade de quem a
  envia (coberta pelo consentimento de FR-013).
- **Foto grande demais (> 5MB) / formato não suportado (fora de JPEG/PNG/WebP) / upload falha**:
  sistema recusa com mensagem e mantém o avatar padrão, sem travar a geração.
- **Auto-indicação** (QR aponta para o próprio visitante) ou **indicador inexistente**: ignora a
  atribuição, gera o ingresso normalmente.
- **Participante sem internet estável ao compartilhar**: download da imagem funciona; o registro do
  compartilhamento é best-effort e não bloqueia a experiência.
- **Consentimento de dados**: a coleta de nome/e-mail/telefone (e foto opcional) exige aceite; sem
  aceite, a geração não prossegue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST permitir gerar um ingresso informando nome, e-mail e telefone,
  validando o formato de e-mail e telefone antes de prosseguir.
- **FR-002**: O sistema MUST criar (ou reaproveitar, se já existir por e-mail **ou** telefone) um
  participante/lead a partir dos dados informados na geração do ingresso.
- **FR-003**: O sistema MUST oferecer duas opções de imagem no ingresso: enviar a própria foto **ou**
  manter um avatar padrão; a opção padrão MUST ser o avatar (sem exigir upload).
- **FR-004**: O sistema MUST gerar um ingresso visual com a identidade do evento contendo, no mínimo,
  o nome do participante e a imagem escolhida (foto ou avatar).
- **FR-005**: Após a geração, o sistema MUST exibir ao participante seu link pessoal de acesso
  (individual, sem senha) em uma tela dedicada e também entregá-lo por e-mail (reuso da 8.1).
- **FR-017**: O sistema MUST permitir que o participante recupere seu link de acesso informando o
  e-mail cadastrado (sem senha); o link recuperado MUST ser **reenviado ao e-mail cadastrado** e
  NUNCA exibido na tela em resposta a um e-mail digitado. A exibição na tela só é permitida logo
  após a geração, na mesma sessão (FR-005).
- **FR-018**: A recuperação MUST não revelar se um e-mail está ou não cadastrado (resposta neutra do
  tipo "se este e-mail estiver cadastrado, enviamos o link"), evitando enumeração de e-mails e
  vazamento de dado pessoal.
- **FR-006**: O sistema MUST permitir baixar o ingresso como imagem e compartilhá-lo em redes e
  WhatsApp.
- **FR-007**: O ingresso compartilhável MUST conter um QR code **público** que direcione quem o
  escaneia para a tela de geração de ingresso, **sem** conceder acesso à conta de quem compartilhou.
- **FR-008**: O QR code de cada ingresso MUST carregar o identificador do seu dono, de modo que uma
  geração originada dele seja atribuível como indicação.
- **FR-009**: Ao gerar um ingresso a partir de um QR de indicação válido, o sistema MUST registrar o
  novo participante como indicado pelo dono do QR.
- **FR-010**: O sistema MUST ignorar a atribuição de indicação quando o indicador for inexistente ou
  igual ao próprio novo participante (auto-indicação), ainda gerando o ingresso normalmente.
- **FR-011**: O sistema MUST emitir um evento de engajamento de compartilhamento (`ticket.shared`,
  com o canal) quando o participante compartilhar seu ingresso.
- **FR-012**: O sistema MUST disponibilizar a informação de origem por indicação para consumo da
  Story 8.7 (ranking/atribuição), sem, nesta story, implementar ranking ou premiação.
- **FR-013**: O sistema MUST exigir consentimento explícito para uso dos dados pessoais (e da foto,
  quando enviada) antes de concluir a geração.
- **FR-014**: A geração de ingresso MUST ser idempotente por e-mail **ou** telefone — repetir com
  qualquer um dos dois já cadastrado não cria participante duplicado nem novo identificador de
  indicação.
- **FR-015**: O sistema MUST recusar upload de foto inválida com mensagem clara e manter o avatar
  padrão, sem interromper a geração. Limites: **tamanho ≤ 5MB** e **formatos aceitos: JPEG, PNG,
  WebP**; qualquer coisa fora disso (ou erro de upload) é recusada com fallback ao avatar.
- **FR-016**: A experiência de geração e de exibição do ingresso MUST ser desenhada e validada
  primeiro no mobile (o participante vive o evento no celular).

### Key Entities *(include if feature involves data)*

- **Participante (Lead)**: pessoa que gerou o ingresso. Atributos-chave: nome, e-mail, telefone,
  imagem escolhida (foto ou avatar), identificador próprio, indicador de origem (opcional).
- **Ingresso/Credencial**: ativo visual gerado para o participante. Atributos: nome exibido, imagem
  (foto/avatar), identidade do evento, QR code público que carrega o identificador do dono.
- **Indicação (origem)**: vínculo "quem indicou quem" capturado na geração — indicador (dono do QR) e
  indicado (novo participante). Consumida pela Story 8.7.
- **Acesso pessoal**: credencial de entrada individual e sem senha associada ao participante
  (reutiliza a fundação de acesso da Story 8.1).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um visitante consegue gerar o ingresso e receber o acesso em menos de 90 segundos, do
  primeiro toque até o ingresso exibido.
- **SC-002**: 100% dos ingressos gerados incluem o nome do participante e um QR code público de
  convite funcional (que abre a tela de geração e não a conta do dono).
- **SC-003**: Nenhuma geração cria participante duplicado quando o mesmo e-mail é reutilizado
  (idempotência verificável em 100% dos casos).
- **SC-004**: Ao menos 20% da audiência do evento chega por indicação atribuída via QR (meta do
  épico: 20–30%).
- **SC-005**: 95% das gerações de ingresso concluem sem erro de fluxo (excluindo dados inválidos
  informados pelo usuário).
- **SC-006**: 100% das aberturas do QR de um ingresso levam a novos visitantes à tela de geração,
  nunca à sessão de quem compartilhou (zero vazamento de sessão).

## Assumptions

- **Ingresso como cadastro (gatilho de conversão)**: diferente da redação literal do épico ("ingresso
  por inscrito"), assume-se que a geração do ingresso é o próprio ponto de inscrição — coletar
  nome/e-mail/telefone cria o lead. Decisão validada com o solicitante (o ingresso é a "isca").
- **Reuso da fundação de acesso (Story 8.1)**: o "link pessoal de acesso" reutiliza o mecanismo de
  magic link já implementado (sessão sem senha), não sendo reimplementado aqui.
- **Fronteira com Indicações (Story 8.7)**: esta story captura a origem da indicação e emite o evento
  de compartilhamento; ranking, premiação por meta e métricas de origem são escopo da 8.7.
- **Contrato de eventos (FROZEN)**: esta story **emite** `ticket.shared` (no compartilhamento) e
  `referral.signup` (na geração via indicação); a 8.7 **consome** para ranking/premiação. A tabela
  FROZEN de CONTRIBUTING §3 foi atualizada neste PR para refletir emite=8.3 / consome=8.7.
- **Templates de identidade prontos**: o design do ingresso vem de template pré-configurado por tema
  (plug-and-play), sem design manual por evento.
- **Foto é opt-in**: o avatar padrão é o comportamento default; a foto é uma escolha ativa do
  participante e implica consentimento de uso de imagem.
- **Sem moderação de fotos**: as fotos enviadas não passam por revisão manual nem automática —
  decisão de negócio validada por ~1 ano operando o mesmo fluxo sem incidentes. Caso surja abuso, a
  remoção pontual fica a cargo do admin (fora do escopo desta story).
- **Fora de escopo (v1)**: certificado, PDF do ingresso (apenas imagem em v1), ranking/premiação de
  indicações, e qualquer canal externo que tire o participante da plataforma.

## Dependencies

- **Story 8.1 (Magic Link)** — fundação de acesso pessoal sem senha (concluída).
- **Contrato de eventos de engajamento** — emissor compartilhado + webhook de saída.
- **Story 8.7 (Indicações)** — consumidora da origem de indicação capturada aqui (ranking/premiação).
