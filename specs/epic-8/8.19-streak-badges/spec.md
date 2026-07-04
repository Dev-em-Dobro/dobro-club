# Feature Specification: Streak e badges de engajamento (gamificação)

**Feature Branch**: `feat/8.19-streak-badges`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Dar ao participante um streak (dias consecutivos ativos) e badges (conquistas) para incentivar o hábito de voltar durante o aquecimento; e permitir que o time consuma esses sinais. Consome eventos + lead score; não altera emissão nem instrumenta progresso de vídeo."

> **Produto:** Dobro Club · **Epic:** 8 · **Story:** 8.19 · **Trilho:** A/B — Dados & Engajamento + Crescimento
> **Depende de:** contrato de eventos (CONTRIBUTING §3) emitido por 8.14 (`content.opened`) e 8.17
> (`live.opened`); **lead score** 8.18 (`lib/score.ts`) para badges por score; sessão magic link 8.1 e
> hub 8.12 para a superfície do participante.
> **Fronteira:** story de **consumo + exibição**. NÃO altera emissão, NÃO instrumenta progresso de vídeo
> — o refinamento "dia ativo = assistiu ≥10%" fica para uma **story futura** que emita progresso; aqui o
> "dia ativo" usa os eventos de **abertura** de conteúdo/live que já existem. **Badges persistidos**
> (com "conquistado em"/"novo!") também ficam para evolução futura.

## Clarifications

### Session 2026-07-03

- Q: O que conta como "dia ativo" no streak? → A: **dia com ≥1 evento de consumo de conteúdo**
  (`content.opened` **ou** `live.opened`). (O critério "assistiu ≥10%" exige um evento de progresso que
  ainda não emitimos — fica para o futuro.)
- Q: Como definir os badges nesta versão? → A: **regras fixas no código, derivadas na leitura** (sem
  tabela de conquistas); determinístico.
- Q: Streak/badges são persistidos? → A: **Não** — **derivados on-demand** dos eventos/score; sem tabela
  nem coluna nova.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver meu streak e me sentir incentivado a voltar (Priority: P1) 🎯 MVP

O participante abre o hub e vê seu **streak** — quantos **dias consecutivos** ele esteve ativo (abriu
conteúdo/live) — de forma destacada e motivadora, para criar o hábito de voltar todo dia durante o
aquecimento.

**Why this priority**: o streak é o gancho de retorno mais forte da gamificação e sozinho já incentiva o
hábito. É o núcleo visível para o participante.

**Independent Test**: com um lead autenticado que teve atividade em dias consecutivos, abrir o hub e ver
o streak atual correto; simular um dia sem atividade e ver o streak reiniciar.

**Acceptance Scenarios**:

1. **Given** um lead que abriu conteúdo/live em **3 dias consecutivos** terminando hoje, **When** abre o
   hub, **Then** vê **streak = 3**.
2. **Given** um lead cujo último dia ativo foi **há mais de 1 dia** (quebrou), **When** abre o hub,
   **Then** vê o streak **zerado/recomeçando** conforme a regra de tolerância.
3. **Given** um lead **sem** nenhuma atividade, **When** abre o hub, **Then** vê **streak = 0** (com um
   convite a começar).
4. **Given** um lead com histórico, **When** vê seu painel, **Then** também vê seu **maior streak**
   (longest) como marca a superar.
5. **Given** um lead **sem sessão válida**, **When** tenta ver o streak, **Then** o acesso é impedido.

---

### User Story 2 - Conquistar e ver badges (Priority: P2)

O participante vê **badges** que já conquistou e badges **a conquistar** (bloqueados, com o critério),
transformando o engajamento em uma jornada de conquistas que puxa mais ações.

**Why this priority**: badges complementam o streak com metas variadas (1ª live, N conteúdos, engajado
por score), mas dependem do painel/streak existir para ganhar contexto.

**Independent Test**: com um lead que cruzou o critério de alguns badges, abrir o painel e ver esses
badges como **conquistados** e os demais como **bloqueados** com o critério; cruzar um novo critério e
ver o badge virar conquistado.

**Acceptance Scenarios**:

1. **Given** um lead que **abriu ao menos 1 live**, **When** vê seus badges, **Then** o badge "assistiu à
   primeira live" aparece como **conquistado**.
2. **Given** um lead que **ainda não** cruzou um critério, **When** vê seus badges, **Then** aquele badge
   aparece como **bloqueado** com o **critério** descrito (ex.: "abra 5 conteúdos").
3. **Given** um lead com **lead score ≥ limiar**, **When** vê seus badges, **Then** o badge "engajado"
   aparece como **conquistado**.
4. **Given** o **mesmo** conjunto de eventos, **When** os badges são calculados de novo, **Then** o
   resultado é **idêntico** (determinístico).

---

### User Story 3 - Consumir streak e badges de um lead (time/automação) (Priority: P3)

O time (ou uma automação) consulta o **streak e os badges** de um lead por uma borda protegida, para
priorização/segmentação e para reconhecer publicamente os mais engajados.

**Why this priority**: dá alavancagem ao dado além da tela do participante, mas o valor de incentivo
central (US1/US2) já existe sem essa borda.

**Independent Test**: consultar, por borda autorizada, o streak+badges de um lead conhecido e verificar
que batem com o cálculo; sem autorização, a consulta é negada.

**Acceptance Scenarios**:

1. **Given** uma consulta **autorizada** ao streak+badges de um lead, **When** executada, **Then**
   retorna streak atual, maior streak e a lista de badges (conquistados/bloqueados).
2. **Given** uma consulta **sem autorização**, **When** executada, **Then** é **negada**.
3. **Given** um lead **sem eventos**, **When** consultado, **Then** retorna **streak 0 e nenhum badge
   conquistado** (sem erro).

---

### Edge Cases

- **Vários eventos no mesmo dia**: contam como **um** dia ativo (não inflam o streak).
- **Fuso horário / virada do dia**: "dia" é por **dia de calendário no fuso do evento** (ver
  Assumptions) — atividade às 23h e 00h05 são **dois** dias.
- **Tolerância "hoje vs. ontem"**: se o lead ainda não teve atividade **hoje** mas teve **ontem**, o
  streak vigente **não** deve ser exibido como quebrado no meio do dia (regra de tolerância definida no
  plano) — evita punir quem ainda vai voltar hoje.
- **Lead sem eventos**: streak 0, nenhum badge; painel mostra convite a começar (degradação segura).
- **Badge com critério baseado em score**: reúsa o lead score (8.18); se o score muda, o badge reflete
  na próxima leitura.
- **Critério/badge desconhecido no catálogo**: não quebra o cálculo dos demais.
- **Sem sessão válida**: participante não vê nada; borda de consumo sem autorização é negada.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST calcular o **streak atual** de um lead = número de **dias de calendário
  consecutivos** (no fuso do evento) com **≥1** evento `content.opened`/`live.opened`, terminando no dia
  corrente (com **tolerância** para "ainda não voltou hoje" — regra no plano).
- **FR-002**: O sistema MUST calcular o **maior streak** (longest) do lead no histórico.
- **FR-003**: Múltiplos eventos no mesmo dia MUST contar como **um** dia ativo; um dia sem atividade MUST
  **quebrar** o streak.
- **FR-004**: O sistema MUST calcular os **badges** de um lead a partir de um **catálogo de regras fixas**
  (derivadas de eventos, streak e lead score), marcando cada badge como **conquistado** ou **bloqueado**;
  os bloqueados MUST expor o **critério** para incentivo.
- **FR-005**: Streak e badges MUST ser **derivados no momento da leitura** (sem persistência) e MUST
  **refletir** os eventos/score existentes naquele instante.
- **FR-006**: O cálculo MUST ser **determinístico**: mesmo conjunto de eventos ⇒ mesmo streak e mesmos
  badges.
- **FR-007**: O **participante** MUST ver o próprio streak e badges **dentro do hub**, com **sessão
  válida** (magic link, 8.1), sem senha; a tela MUST ser **mobile-first** (375–430px, ≥44px, sem layout
  shift).
- **FR-008**: O sistema MUST expor streak+badges de um lead em uma **borda protegida** (consumo
  admin/automação), separada da superfície do participante.
- **FR-009**: Esta story MUST **apenas consumir** o contrato de eventos + o lead score; MUST **não**
  emitir eventos novos nem adicionar tipo à taxonomia.
- **FR-010**: O sistema MUST **degradar de forma segura**: lead sem eventos ⇒ streak 0 e nenhum badge;
  critério/badge desconhecido não quebra o cálculo.
- **FR-011**: O **catálogo de badges** MUST ser **versionado** (nome, descrição, critério), incluindo ao
  menos: "primeira live", "abriu N conteúdos", "streak de 3 dias", "streak de 7 dias", "engajado" (score
  ≥ limiar). Valores/limiar confirmados no plano.

### Key Entities *(include if feature involves data)*

- **Evento de engajamento**: registro existente (tipo + lead + evento + momento) — fonte do streak
  (dias com `content.opened`/`live.opened`) e de badges por evento. Reúso; sem alteração.
- **Lead score (8.18)**: entrada para badges por score. Reúso (`lib/score.ts`).
- **Streak (derivado)**: `{ current, longest }` por (lead, evento), computado dos dias ativos.
- **Badge (regra fixa versionada)**: `{ id, nome, descrição, critério, conquistado }`. Catálogo no
  código; estado **derivado** por lead (conquistado/bloqueado). Sem persistência.
- **Lead**: participante com sessão (8.1). Sem novo dado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para um lead com atividade em **N** dias consecutivos terminando hoje, o streak retornado é
  **exatamente N**.
- **SC-002**: Um dia de calendário sem atividade **quebra** o streak em **100%** dos casos; retomar a
  atividade reinicia a contagem.
- **SC-003**: Vários eventos no mesmo dia **nunca** aumentam o streak além de **1** por dia.
- **SC-004**: **100%** dos badges cujo critério foi cruzado aparecem como **conquistados**; os demais como
  **bloqueados** com critério visível.
- **SC-005**: **100%** das leituras do mesmo conjunto de eventos retornam **o mesmo** streak e os **mesmos**
  badges (determinismo).
- **SC-006**: Um lead **sem eventos** retorna **streak 0 e 0 badges conquistados** sem erro.
- **SC-007**: **100%** das consultas de consumo sem autorização são **negadas**; **100%** dos acessos do
  participante sem sessão válida são impedidos.
- **SC-008**: A tela do participante do streak/badges é utilizável a **375–430px** (mobile-first) sem
  layout shift.

## Assumptions

- **Dia ativo** = dia de calendário (fuso do evento, assumido **America/São_Paulo** salvo config) com ≥1
  `content.opened`/`live.opened`. "≥10% assistido" é evolução futura (exige evento de progresso).
- **Tolerância do streak**: o streak "vigente" considera ativo até **ontem** como ainda válido durante o
  dia de hoje (não quebra ao virar a meia-noite antes de a pessoa voltar); a regra exata (hoje vs. ontem)
  é confirmada no plano. Objetivo: não punir quem ainda vai voltar hoje.
- **Derivado/on-demand**, sem persistência — recalcula na leitura (Const. VI); sem tabela/coluna nova.
- **Catálogo de badges fixo no código** (versionado), com limiares confirmáveis no plano (ex.: N
  conteúdos = 5; streak 3 e 7; "engajado" = score ≥ 20 via 8.18). Badges persistidos/"novo!" ⇒ futuro.
- **Autorização**: participante por sessão `dc_session` (8.1); consumo admin/automação por credencial de
  admin (padrão `X-Api-Key`). Sem admin UI (8.9).
- **Reúso**: `engagement_events`, `lib/score.ts`, `lib/leads.ts`, `lib/events.ts`, hub 8.12. Só leitura.
- **Fronteira**: não emite eventos, não instrumenta progresso de vídeo, não persiste conquistas.
