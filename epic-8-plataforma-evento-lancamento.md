# Epic 8: Dobro Club — Plataforma de Evento de Lançamento ("Ambiente Oficial do Evento")

**Status:** Planning
**Produto:** **Dobro Club** — nome do nosso ambiente oficial de evento (equivalente interno ao "Scale/Scaled Club" de referência, da Rocket City).
**Objetivo:** Construir, no nosso stack (`dashboard/` React+Vite + `server.js` Express), um ambiente único e dedicado de evento de lançamento que centralize inscrição, pesquisa, aulas, comunidade, feed, ingresso, indicações, certificados, métricas e lead scoring — eliminando o tool-sprawl (WhatsApp + Drive + Zoom + YouTube + checkout espalhados) e habilitando personalização em tempo real.

**Origem / Insumo estratégico:** `squads/lancamentos/data/estrategia-evento-experiencia-scale-club.md` (análise da plataforma Scale Club da Rocket City). Tese: *"o lançamento não morreu, a experiência morreu"*.

**Stack alvo:** Frontend `dashboard/src/components/sections/`, backend `server.js` (Express, porta 3001), padrões `fsLib`/`pathLib`. Tema dark Tailwind.

**Decisão pendente (gate):** build vs. buy — replicar internamente (este epic) vs. pilotar o Scale Club (R$6k/6 meses) em um lançamento. Recomenda-se pilotar 1 evento para validar a tese antes de comprometer o build completo.

---

## Princípios de design (não-negociáveis)

- **Mobile-first, experiência premium no celular (não-negociável).** O participante vive o evento no celular; o desktop é secundário. Desenhar e validar **primeiro no mobile** (375–430px), com toque confortável (alvos ≥44px), gestos nativos, transições suaves (60fps), bottom-nav/sheets em vez de menus desktop, safe-areas, suporte offline básico e PWA (add-to-home, sem app nativo). Nada de "responsivo como adaptação do desktop" — o mobile é o produto. Funciona inclusive para público 45–60+.
- **Magic link:** acesso por link sem senha; sessão persistente no navegador; mesmo link reutilizável em e-mail/WhatsApp.
- **Ambiente único e sem distração:** menus mínimos para o participante (Aulas, Comunidade, Feed, Ingresso, Indicações, Certificado). Nada que tire o usuário do evento.
- **Tudo é mensurado:** cada ação do usuário emite um evento → métricas por usuário + webhook para automações externas.
- **Notificações** permanecem em WhatsApp + e-mail (web push é best-effort, depende do SO).

---

## MVP (v1) — escopo do primeiro piloto

**Objetivo do MVP:** rodar **UM lançamento real, de ponta a ponta, num único ambiente**, validando a tese: experiência centralizada + medir tudo + personalizar no momento. Entregue **mobile-first premium**.

### Núcleo (obrigatório)
- **8.1 Magic Link** — entrada sem fricção + webhook de inscrição (reforço no WhatsApp).
- **8.2 Pesquisa-gate** — pesquisa na 1ª tela + leitura em tempo real (personalização **manual** pelo estrategista).
- **8.4 Aulas** — embed da live (YouTube) + gravação + **comparecimento por lead** (sem quiz no MVP).
- **8.8 Lead Scoring** — pontuação por engajamento + lista exportável com telefone.
- **8.9 Admin + Métricas** — painel mínimo para montar o evento + métricas em tempo real.
- **8.3 Ingresso compartilhável** — versão simples (imagem com identidade + link de captação). Barato e central ao "gatilho de evento".

### Fast-follow (v1.1)
- **8.7 Indicações completo** (ranking, premiação por meta, prefill WhatsApp, atribuição) — salto de CAC negativo.
- **Quizzes** (8.4) e **auto-roteamento de conteúdo por nível** (8.2).

### v2
- **8.5 Feed**, **8.6 Comunidade**, **8.10 Certificados**, **8.11 E-mail nativo**.

### Critério de sucesso do piloto
- Pesquisa obrigatória com **>80% de resposta**.
- **Comparecimento medido por lead** (não pico de live).
- Leads quentes **exportados e usados pelo comercial**.
- **Taxa de conclusão** maior que evento anterior com ferramentas espalhadas.
- Experiência fluida **no celular**.

> **Nota build vs. buy:** o caminho de validação mais barato pode ser pilotar o Scale Club (R$6k/6 meses) em 1 evento antes de construir. Esta seção assume a decisão de **build**.

---

## Story 8.1: Inscrição + Magic Link (entrada sem fricção)

**As a** lead inscrito num evento,
**I want** entrar no ambiente do evento com um clique, já logado, sem senha,
**so that** eu não desista por fricção e acesse tudo num único lugar.

### Acceptance Criteria
- [ ] Ingestão de lead via **API** a partir da página de captação **externa** (evento gratuito no MVP); checkout pago (Ticto/Hubla) fica para fase posterior.
- [ ] Geração de **magic link** único por lead (**token opaco armazenado e revogável**, sem senha).
- [ ] Link entregue por e-mail e disponível para envio via WhatsApp; ao clicar, usuário entra **já logado**.
- [ ] Sessão persistida no navegador (login mantido até limpar cookies).
- [ ] Mesmo magic link é exposto via **webhook de inscrição** para reuso em automações.
- [ ] Responsivo (mobile + desktop) validado em público leigo.

---

## Story 8.2: Pesquisa Integrada como Gate (com leitura em tempo real)

**As a** estrategista de lançamento,
**I want** uma pesquisa obrigatória na primeira tela do evento, lida em tempo real,
**so that** eu personalize conteúdo e oferta durante o evento (não 15 dias depois no debriefing).

### Acceptance Criteria
- [ ] Pesquisa é a **primeira tela** após o primeiro acesso ao ambiente.
- [ ] Configuração de obrigatoriedade (gate): respostas liberam a próxima etapa (aula/comunidade).
- [ ] Construtor de perguntas (múltipla escolha, escala, texto) por evento.
- [ ] Suporte a **formato conversacional (chat/onboarding)** da pesquisa, além de formulário (ex.: bot pergunta faixa de idade e nível — Iniciante/Intermediário/Avançado/Ninja).
- [ ] **Personalização/roteamento de conteúdo por nível ou perfil** do lead a partir das respostas (não só leitura para o estrategista) — base da hiperpersonalização em tempo real.
- [ ] Respostas associadas ao registro do lead e **disponíveis em tempo real** no admin.
- [ ] Dashboard de pesquisa com agregação ao vivo (distribuições por pergunta).
- [ ] Meta de referência: **>80% de taxa de resposta** quando obrigatória.

---

## Story 8.3: Ingresso compartilhável (mesmo em evento gratuito)

**As a** participante do evento,
**I want** um ingresso bonito que eu possa baixar e compartilhar,
**so that** eu sinta que tenho um ativo (gatilho de evento) e divulgue organicamente.

### Acceptance Criteria
- [ ] Geração automática de ingresso por inscrito (nome + evento + data), com design da identidade do evento.
- [ ] Download (imagem) + botão de compartilhar para redes/WhatsApp.
- [ ] Funciona para eventos gratuitos e pagos.
- [ ] Compartilhamento carrega link de captação/indicação (rastreável — ver Story 8.7).
- [ ] Templates prontos por tema (plug-and-play), sem necessidade de design manual por evento.

---

## Story 8.4: Área de Aulas com embed de live e métricas por usuário

**As a** produtor do evento,
**I want** entregar as aulas/lives dentro da plataforma (embed do YouTube + chat),
**so that** eu meça comparecimento e engajamento reais por lead, não só "pico de live".

### Acceptance Criteria
- [ ] Cadastro de aulas/lives por evento; **embed da live do YouTube** com chat dentro da plataforma.
- [ ] Gravação disponível na mesma aula após o ao vivo.
- [ ] Métricas **por usuário**: quem assistiu, qual aula, tempo/engajamento, comparecimento real.
- [ ] **Quizzes interativos** cadastráveis dentro das aulas, com respostas registradas.
- [ ] Quiz com **prazo de resposta** configurável (ex.: "responda até DD/MM para concorrer à premiação do evento").
- [ ] **Tentativa única** (anti-repetição) com exibição de resultado/acertos (ex.: 6/12).
- [ ] Vínculo opcional do quiz à **premiação/gamificação** do evento.
- [ ] Eventos de engajamento emitidos para o lead scoring (Story 8.8).

---

## Story 8.5: Feed Interativo (antecipação durante a captação)

**As a** produtor do evento,
**I want** um feed estilo rede social para postar conteúdo diário no período de captação,
**so that** os leads cheguem engajados ao dia do evento (e não fiquem "no vácuo" por 30 dias).

### Acceptance Criteria
- [ ] Feed por evento onde o produtor posta conteúdo (texto, áudio, vídeo, desafio).
- [ ] Usuários interagem (curtir/comentar) e recebem novos posts ao longo da captação.
- [ ] Durante o evento, vira **mural central** de materiais, aulas e desafios.
- [ ] Sem distrações externas (mantém o usuário no ambiente do evento).
- [ ] Interações alimentam o lead scoring.

---

## Story 8.6: Comunidade integrada

**As a** participante,
**I want** abrir e participar de discussões dentro do mesmo ambiente do evento,
**so that** eu gere networking e pertencimento sem sair para Facebook/Discord.

### Acceptance Criteria
- [ ] Menu "Comunidade" no mesmo ambiente (sem redirecionar para fora).
- [ ] Usuários criam tópicos, comentam e interagem; equipe pode impulsionar/responder.
- [ ] Moderação básica (fixar, remover, destacar) pelo admin.
- [ ] Visão admin de **Comentários** centralizada (moderar/responder comentários de todo o evento num só lugar).
- [ ] Atividade de comunidade alimenta o lead scoring.

---

## Story 8.7: Sistema de Indicações (referral) com pré-preenchimento de WhatsApp

**As a** participante fã do evento,
**I want** convidar amigos com um clique (link de indicação),
**so that** eu participe do ranking/prêmios e o evento cresça organicamente com leads quentes.

### Acceptance Criteria
- [ ] Link de indicação único por usuário, exposto no **webhook de inscrição**.
- [ ] Botão "convidar" abre a lista de contatos do WhatsApp com **mensagem pré-preenchida**.
- [ ] Inscrições via link contabilizadas como indicação do referenciador.
- [ ] **Ranking** de quem mais indica + suporte a premiação (top-N por colocação).
- [ ] **Premiação automática por meta de indicações** (limiar/threshold — ex.: +5 indicações desbloqueia prêmio A, +15 desbloqueia prêmio B), independente do ranking top-N.
- [ ] Métrica de origem (indicação vs. pago) e CPL por canal no admin.
- [ ] Meta de referência: **20–30% da audiência via indicação**.

---

## Story 8.8: Lead Scoring por engajamento (lista + Kanban por aula)

**As a** time comercial,
**I want** uma pontuação de engajamento por lead e visão por aula,
**so that** eu priorize os leads mais quentes (que mais compram) na primeira hora.

### Acceptance Criteria
- [ ] Cada ação (responder pesquisa, assistir aula, comentar, indicar) gera pontuação.
- [ ] **Visão em lista** ordenada por score + **Kanban por aula** (quantos/quais usuários em cada aula).
- [ ] Filtro e **exportação** da lista (com telefone para o comercial).
- [ ] Acesso ao telefone/contato direto a partir do painel.
- [ ] (Fase 2) Pontuação configurável também por **resposta de pesquisa** (ex.: praça/perfil = peso maior).

---

## Story 8.9: Admin, Métricas em tempo real e Webhooks

**As a** produtor/estrategista,
**I want** um painel para montar o evento e acompanhar tudo em tempo real, com webhooks,
**so that** eu tome decisões por dado (não suposição) e personalize automações externas.

### Acceptance Criteria
- [ ] Painel admin para criar/configurar o evento sozinho (sem dev): inscritos, pesquisa, aulas, feed, comunidade, ingresso, indicações, certificados, e-mails.
- [ ] Métricas **em tempo real**: inscritos, indicações, comparecimento, engajamento, lead scoring.
- [ ] **Webhooks** para todos os eventos de engajamento (consumíveis por ManyChat/SendFlow/n8n).
- [ ] Esteira de automação personalizada: não disparar "assista a aula" para quem já assistiu.
- [ ] Seleção de **tema** por evento; **domínio próprio** (plano/feature avançada).

---

## Story 8.10: Certificados de conclusão

**As a** participante que concluiu o evento,
**I want** receber um certificado com meu nome,
**so that** eu tenha reconhecimento/moeda social e divulgue organicamente.

### Acceptance Criteria
- [ ] Emissão **automática** de certificado ao atingir os critérios de conclusão configurados (ex.: % de aulas assistidas, quizzes respondidos).
- [ ] Critérios de conclusão **configuráveis por evento** no admin.
- [ ] Template de certificado com a **identidade do evento** (nome do participante + evento + data).
- [ ] Download (imagem/PDF) + botão de compartilhar (gatilho de moeda social, ver Story 8.3).
- [ ] Item "Certificado" no menu do participante, visível quando liberado.
- [ ] Emissão do certificado emite evento para métricas/lead scoring e webhook.

---

## Story 8.11: Módulo de E-mail nativo (broadcast por evento)

**As a** produtor do evento,
**I want** compor e disparar e-mails para os inscritos de dentro do painel,
**so that** eu comunique avisos/lembretes sem depender exclusivamente de ferramenta externa.

> **Decisão de escopo:** o produto de referência expõe "E-mail" como seção nativa do admin. Avaliar **build** (módulo nativo) vs. **delegar** 100% às automações externas (ManyChat/SendFlow/n8n via webhook). Recomendação v1: disparo nativo simples + webhook para o resto.

### Acceptance Criteria
- [ ] Seção "E-mails" no admin para compor e enviar e-mail aos inscritos (ou segmento) do evento.
- [ ] Segmentação básica por status/engajamento/lead score.
- [ ] Métricas básicas de envio (enviados; entregues/abertos quando o provedor suportar).
- [ ] Reuso do **magic link** do lead nos e-mails (entrar já logado — ver Story 8.1).
- [ ] Eventos de e-mail (enviado/clicado) disponíveis via webhook.

---

## Métricas de sucesso do epic

- Taxa de resposta de pesquisa **>80%** (vs. ~40% no fluxo Google Forms).
- **20–30%** da audiência via indicação; CPL de indicação significativamente menor que pago.
- Comparecimento real medido por lead (não estimado por pico de live).
- Taxa de conclusão do evento **maior** que eventos com ferramentas espalhadas.
- Redução de chamados de suporte do tipo "onde fica X".
- Certificados emitidos a quem concluiu (proxy de conclusão + moeda social gerada).
- Experiência mobile: tempo de carregamento, Core Web Vitals e taxa de conclusão de fluxos medidos **no celular** (público majoritariamente mobile).

## Dependências e integrações

- Checkout: Ticto / Hubla (eventos pagos).
- Mensageria: WhatsApp (API oficial) + e-mail; automações ManyChat / SendFlow / n8n via webhook.
- CRM/Scoring: alinhar com Epic 6 (aquecimento de leads) e a base de Lead Score consolidada (`docs/30) ... / DED Lead Score`).
- Vídeo: embed YouTube (live + gravação).

## Fora de escopo (v1)

- App nativo (decisão: web responsiva apenas).
- Web push como canal primário (best-effort).
- Pontuação de scoring por resposta de pesquisa (Fase 2).

## Sequenciamento sugerido (maior ROI primeiro)

1. **8.1 Magic Link** (fundação de acesso) → 2. **8.2 Pesquisa-gate** → 3. **8.8 Lead Scoring** → 4. **8.3 Ingresso** → 5. **8.4 Aulas/embed** → 6. **8.7 Indicações** → 7. **8.9 Admin/Webhooks** → 8. **8.11 E-mail** → 9. **8.5 Feed** → 10. **8.6 Comunidade** → 11. **8.10 Certificados**.
