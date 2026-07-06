# Research: Onboarding via ActiveCampaign

Resolve os pontos técnicos em aberto do plano. Foco: reúso da 8.1 e a fiação da AC.

## R1 — O webhook `lead.created` é consumível pela AC como está?

- **Decisão**: Manter o payload atual (`lib/webhook.ts` → `fireInscriptionWebhook`), que já expõe o
  `magicLink` no **topo** do JSON, junto de `event` e `lead`. A AC consome via automação de **incoming
  webhook** (ou um intermediário como n8n/Zapier), mapeando `magicLink` para um **campo do contato**.
- **Rationale**: o link já está disponível e nomeado (`magicLink`); não há motivo para um contrato
  novo. A capacidade de a AC ler JSON aninhado (`event.slug`, `lead.email`) é **configuração externa** —
  fora do código da plataforma. A plataforma só **garante** que o `magicLink` está presente e correto.
- **Alternativas rejeitadas**:
  - *Achatar o payload* (ex.: `event_slug`, `lead_email`) para facilitar a AC — adia decisão de forma
    externa e mudaria o contrato já usado por outras automações; se necessário, é ajuste de **config
    intermediária** (n8n), não da plataforma.
  - *A plataforma escrever direto no campo do contato via API da AC* — vira integração de **saída** com
    credencial/estado da AC do nosso lado; contraria a decisão de **mão única** (spec) e o "não escrever
    na AC".

## R2 — Quem envia o e-mail de onboarding? (conflito do e-mail duplicado)

- **Contexto**: hoje `POST /api/events/[eventId]/leads` envia `sendMagicLinkEmail` **e** dispara o
  webhook quando `isNew`. Com a AC enviando o onboarding, os dois e-mails colidiriam.
- **Decisão**: introduzir **`events.onboarding_channel`** (`platform` | `active-campaign`, default `platform`):
  - `platform` (default): comportamento atual **intacto** (plataforma envia o e-mail de magic link) —
    não quebra eventos existentes / outros fluxos.
  - `active-campaign`: a plataforma **não** envia o e-mail; **apenas** dispara o webhook `lead.created` com o
    `magicLink`, e a AC envia o onboarding.
  - Em **ambos**, o webhook continua disparando (a AC pode consumir mesmo no modo `platform`).
- **Rationale**: discriminador explícito é testável e não acopla o comportamento à mera presença de
  `webhook_url`. Default preserva compatibilidade (Const. V/VI).
- **Alternativas rejeitadas**:
  - *Inferir do `webhook_url`* (se tem URL, não manda e-mail) — implícito e frágil; muitos eventos
    podem ter webhook e ainda querer o e-mail da plataforma.
  - *Remover o `sendMagicLinkEmail` de vez* — quebraria eventos que dependem do e-mail nativo (8.1).

## R3 — Onde acontece o "gate de qualificação" (só contatos qualificados viram lead)?

- **Decisão**: **na AC** (externo). A automação da AC só chama a ingestão quando o contato entra na
  **lista/tag/estágio de qualificação do evento**. A plataforma **não** implementa gate de
  qualificação — confia no chamador autenticado por `X-Api-Key`.
- **Rationale**: mantém a plataforma simples e a regra de negócio de captação onde ela vive (AC). A
  segurança da borda é o `X-Api-Key` do evento.
- **Alternativas rejeitadas**: *gate na plataforma* (ex.: aceitar só contatos com certa tag no payload)
  — duplicaria regra da AC e exigiria a plataforma conhecer a taxonomia de tags da AC.

## R4 — Provisionamento por evento (sem admin UI)

- **Decisão**: configurar o evento por **DB/config** (setar `webhook_url` = URL de entrada da AC e
  `onboarding_channel='active-campaign'`), no mesmo padrão de "sem interface de admin" da 8.4/8.14 (admin é 8.9). O
  `X-Api-Key` do evento já existe (hash em `events.api_key_hash`).
- **Rationale**: não há rota de criação/edição de evento hoje (só ingestão/conteúdo por `eventId`);
  criar admin UI está fora do escopo e é a story 8.9. Config/DB é suficiente para 1 evento ativo.
- **Alternativas rejeitadas**: *rota admin para editar evento* — escopo de 8.9; *env var global* — não
  suporta configuração por evento.

## R5 — Identidade canônica (email) e validação

- **Decisão**: **não** endurecer a validação de ingestão. `validateLeadInput` continua exigindo **email
  ou telefone** (comportamento 8.1). Como a captação **sempre** coleta email, o lead vindo da AC terá
  email na prática; o onboarding (e-mail) usa o email como **identidade canônica**. Contato sem email é
  **exceção fora do caminho feliz** (sem entrega nesta story), não um erro de ingestão.
- **Rationale**: evita mudar a fundação da 8.1 e mantém a ingestão tolerante; a garantia de email vem
  do formulário de captação, não de uma regra nova na borda.
