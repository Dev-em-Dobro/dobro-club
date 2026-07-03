# Research: Ingresso/Credencial com indicação por QR (Story 8.3)

Fase 0 — resolve as incógnitas técnicas antes do design. Nenhuma incógnita da spec permaneceu
(moderação de foto foi decidida: sem moderação).

---

## D1 — Composição do ingresso visual

**Decision**: O ingresso é uma **URL de transformação do Cloudinary** montada no cliente/servidor a
partir de um template pré-configurado por evento (`public_id` do template) + overlay de texto (nome)
+ overlay de imagem (foto do participante **ou** avatar padrão). Nenhuma chamada de API bloqueante no
backend — a URL é uma string; o navegador renderiza.

**Rationale**: É exatamente o fluxo que o solicitante já opera há ~1 ano (template no Cloudinary +
avatar). Mantém o backend leve e pg-mem-safe (guardamos só a URL/`public_id` da foto no lead) e
respeita "efeitos externos nunca bloqueiam a resposta" (Constituição VI).

**Alternatives considered**:
- Compor no backend com `sharp`/`canvas`: adiciona dependências pesadas e uma chamada bloqueante por
  geração. Rejeitado.
- Compor 100% no cliente via `<canvas>`: perde a padronização plug-and-play dos templates de marca.
  Usado **apenas** para o arquivo baixável (ver D2), não para o preview.

---

## D2 — QR code embutido na imagem baixável

**Decision**: Valor do QR = URL pública de convite `https://<host>/ingresso?ref=<leadId>`. O QR é
gerado no **cliente** com a lib `qrcode`. O **preview** mostra a imagem do Cloudinary com o QR
sobreposto como elemento. O **download** é composto no cliente via `<canvas>` (fundo = imagem do
ingresso do Cloudinary + QR desenhado), gerando um único PNG para o share sheet.

**Rationale**: Evita depender de serviço externo de QR e de configuração de `fetch overlay` no
Cloudinary. Geração no cliente é instantânea, offline-friendly e mantém o backend sem trabalho de
imagem.

**Alternatives considered**:
- Overlay do QR via `l_fetch:` do Cloudinary (buscar QR de um serviço externo): 1 única URL
  baixável, porém adiciona dependência de um serviço de QR e configuração de fetch. Guardado como
  alternativa se a composição por canvas trouxer atrito de layout.
- QR gerado no backend: trabalho de imagem no servidor sem ganho — rejeitado.

---

## D3 — Upload da foto do participante

**Decision**: Upload **não assinado** direto do cliente para o Cloudinary (upload preset dedicado ao
evento). O backend recebe apenas a `secure_url`/`public_id` resultante e a persiste no lead. Falha de
upload → fallback silencioso para o avatar padrão (best-effort, não trava a geração — FR-015).

**Rationale**: Sem `multer`/SDK/assinatura no backend; mantém a rota de ingresso enxuta e não
bloqueante. Alinhado a "foto é opt-in" e "sem moderação" (decisões da spec).

**Alternatives considered**:
- Proxy de upload no backend (multer + Cloudinary SDK + assinatura): mais controle, porém pesado e
  bloqueante. Rejeitado para v1.

**Follow-up de config**: criar um upload preset não assinado por evento e restringir formatos/tamanho
no widget do cliente (a recusa por tamanho/formato de FR-015 acontece no cliente antes do upload).

---

## D4 — Emissor de engajamento compartilhado (bootstrap)

**Decision**: Esta story entrega `lib/engagement.ts` com
`emit(eventId, leadId, type, data)` que (a) persiste em `engagement_events` (schema do contrato
FROZEN §3) e (b) dispara o webhook de saída best-effort (reusando o padrão de `lib/webhook.ts`).
8.3 é a primeira feature a emitir (`ticket.shared`), logo é a que naturalmente materializa o emissor.

**Rationale**: A Fase 0 compartilhada (que inclui o "emissor de eventos") ainda não está na `main`, e
não há story separada enfileirada para ele. O contrato de `emit()` e da tabela já está **FROZEN** em
CONTRIBUTING §3 — implementamos exatamente esse contrato, sem inventar formato.

**Coordenação**: por ser peça compartilhada entre trilhos, o PR do emissor precisa de review do
Trilho A (dono de scoring/admin que **consome** os eventos). Não alterar a taxonomia sem acordo.

**Alternatives considered**:
- Bloquear 8.3 até o emissor entrar por outro PR: atrasa sem dono definido. Rejeitado.
- Emitir direto na tabela sem um módulo `emit()` compartilhado: quebraria o desacoplamento entre
  trilhos (o único acoplamento permitido é o contrato de eventos). Rejeitado.

---

## D5 — Route Handler público de captação

**Decision**: Novo grupo de **Route Handlers públicos por slug** —
`app/api/e/[slug]/ingresso/route.ts` (`POST`) — sem `X-Api-Key`, protegido por rate limit
(`lib/ratelimit.ts`), validação de input (`lib/validate.ts`) e consentimento obrigatório no corpo. O
`[slug]` resolve o evento (público-safe), diferente das rotas admin que usam `eventId` + `X-Api-Key`.

**Rationale**: O visitante não possui chave de API; a captação precisa ser pública. A base já
antecipa isso (`source: 'captacao-externa'` em `lib/leads.ts`). Separar por `app/api/e/[slug]/*`
deixa claro o contorno público vs. admin. O handler é testável invocando a função exportada com um
`Request` (sem servidor real).

**Alternatives considered**:
- Reusar `POST /api/events/:eventId/leads` (admin, `X-Api-Key`): impossível para o visitante.
- Emitir uma chave pública por evento: complexidade sem ganho; rate limit + validação cobrem o abuso
  esperado para v1.

---

## D6 — Evolução de schema (leads + engagement_events)

**Decision**:
- **`leads`**: adicionar `photo_url text` e `referrer_lead_id text` (sem FK — pg-mem-safe). Editar o
  `CREATE TABLE IF NOT EXISTS leads(...)` em `lib/db.ts` para novos ambientes e adicionar `ALTER TABLE
  leads ADD COLUMN IF NOT EXISTS ...` idempotente em `initSchema` (com try/catch, como nos índices).
- **`engagement_events`**: nova tabela exatamente como o contrato FROZEN §3 (id texto, `event_id`,
  `lead_id`, `type`, `data jsonb`, `created_at`; índices não-parciais).
- **Indicação**: guardada como `referrer_lead_id` (texto) no lead; o grafo/ranking é derivado em TS
  (escopo 8.7), não no banco.

**Rationale**: Segue as convenções não-negociáveis de §5 (ids texto, sem FK, sem `GENERATED`, sem
índice parcial no caminho de teste). `ADD COLUMN IF NOT EXISTS` é suportado e idempotente; falhas em
pg-mem são absorvidas pelo mesmo padrão try/catch dos índices.

**Alternatives considered**:
- Tabela separada `tickets`: o ingresso é derivável (URL Cloudinary + `leadId`); não precisa de
  tabela própria em v1. Rejeitado por simplicidade.
- FK `referrer_lead_id → leads(id)`: proibido por pg-mem (sem FK). Integridade validada em TS.

---

## D7 — Entrega e recuperação do link de acesso (Clarify Q1/Q2)

**Decision**:
- **Logo após gerar** (mesma sessão): o `POST .../ingresso` retorna o `magicLink` e a tela dedicada
  o **exibe** — além do envio por e-mail (reuso `sendMagicLinkEmail`). FR-005.
- **Recuperação posterior** ("esqueci meu link"): `POST .../ingresso/recuperar` **reenvia** o link
  ao e-mail cadastrado e **nunca** o exibe na resposta; responde de forma **neutra**
  ("se este e-mail estiver cadastrado, enviamos o link"), sem revelar se o e-mail existe. FR-017/FR-018.
- WhatsApp como canal de entrega do magic link fica **fora de escopo v1**.

**Rationale**: exibir o link na tela para qualquer e-mail digitado permitiria account-takeover
(o link loga como o dono e rastreia ele) e enumeração de e-mails (vazamento de dado pessoal/LGPD).
A exibição só é segura na mesma sessão que acabou de gerar. Manter passwordless (Princípio II) sem
abrir a porta: recuperação sempre pelo canal de posse (e-mail). Custo ~zero — reusa o envio da 8.1.

**Alternatives considered**:
- Exibir o link na tela para qualquer e-mail (fricção zero): rejeitado — impersonação + enumeração.
- Exibir só com sessão ativa no navegador, senão reenviar por e-mail (Opção C do Clarify): válido,
  mas a recuperação por e-mail já cobre o caso de "outro aparelho" (o único em que a recuperação é
  necessária) com menos código. Guardado como refinamento futuro.

## D8 — Stack: Next.js (App Router) + TypeScript (migração total)

**Decision**: A partir da Constituição v2.0.0, o projeto migra para **Next.js App Router em
TypeScript**, com o Next assumindo o backend (Route Handlers / Server Actions); Express aposentado. A
8.3 é a **primeira story construída em Next**.

**Rationale**: decisão de negócio/arquitetura do time (stack unificada, SSR/estrutura do Next). A
camada de dados e os efeitos (db, leads, events, auth, e-mail, webhook) são **framework-agnostic** e
migram para `lib/` preservando os contratos e testes pg-mem — o que muda é a casca web (Vite→Next) e
a borda HTTP (Express→Route Handlers).

**Alternatives considered**:
- Manter React+Vite+Express (v1.0.0): rejeitado por decisão do time.
- Next só no frontend, Express como API (híbrido): rejeitado — o time optou por Next assumir o backend.

## D9 — Bootstrap da base compartilhada Next+TS (porte da 8.1)

**Decision**: Como 8.1 (magic link/auth/data layer) ainda é Express, a **Foundational da 8.3 porta**
para `lib/` (+ `app/entrar/[token]/route.ts`) o comportamento já testado da 8.1: `db`, `leads`,
`events`, `auth/token`, `auth/session`, `email`, `webhook`, `validate`, `ratelimit`.

**Rationale**: 8.3 precisa dessas fundações para funcionar em Next; portar preserva o comportamento
validado em vez de reescrever do zero. É trabalho **compartilhado** (Fase 0) — review cruzado.

**Alternatives considered**:
- Esperar a migração completa da 8.1/8.2/8.4 antes da 8.3: rejeitado — atrasaria o trilho; portamos
  só o necessário e as demais stories migram em esforço próprio depois.
- Chamar o Express legado a partir do Next durante a transição: rejeitado — dois runtimes/duas auths
  simultâneas aumentam a complexidade e contrariam o single-origin.

## Resumo das decisões

| # | Decisão |
|---|---------|
| D1 | Ingresso = URL de transformação do Cloudinary (template + nome + foto/avatar), não bloqueante |
| D2 | QR no cliente (`qrcode`) apontando `?ref=<leadId>`; download composto via canvas |
| D3 | Foto: upload não assinado cliente→Cloudinary; backend guarda só a URL; fallback avatar |
| D4 | `lib/engagement.ts` + `engagement_events` entregues aqui (contrato FROZEN §3) |
| D5 | Rota pública `POST /api/e/:slug/ingresso` (sem X-Api-Key, com rate limit + consentimento) |
| D6 | +`photo_url`, +`referrer_lead_id` em `leads`; nova tabela `engagement_events`; sem FK |
| D7 | Link exibido na tela só na mesma sessão (pós-geração); recuperação reenvia por e-mail, resposta neutra; WhatsApp fora do v1 |
| D8 | Stack: Next.js (App Router) + TypeScript, Next assume o backend (Constituição v2.0.0) |
| D9 | Foundational porta a base da 8.1 (db/auth/leads/email/webhook) para `lib/` + `app/entrar/[token]` |
