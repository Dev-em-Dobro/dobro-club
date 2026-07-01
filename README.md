# Dobro Club

**Ambiente oficial de evento de lançamento** — uma única plataforma web (mobile-first) que centraliza inscrição, pesquisa, aulas, comunidade, feed, ingresso, indicações, certificados, métricas e lead scoring de um lançamento. O objetivo é acabar com o *tool-sprawl* (WhatsApp + Drive + Zoom + YouTube + checkout espalhados) e habilitar **medir tudo por usuário** e **personalizar em tempo real**.

A tese que originou o projeto: **quanto mais nutrimos e engajamos o participante antes e durante o evento, mais ele desenvolve consciência sobre a área de tecnologia — e maior a tendência de virar aluno.** O evento não é só um pico de audiência; é uma jornada de nutrição que transforma lead em aluno.

Por isso a "experiência fragmentada" é o inimigo: quando a audiência está espalhada por vários links e ferramentas, o engajamento se perde e a nutrição não acontece. Daí a leitura **"o lançamento não morreu, a experiência morreu"**. A solução é uma "casca de evento" própria, sem distração, com entrada por *magic link* — um ambiente único onde dá para **nutrir, engajar, medir tudo por usuário e personalizar em tempo real** ao longo de toda a jornada.

> **Status atual:** MVP em construção. A fundação de acesso (Story 8.1 — Magic Link) está implementada, com armazenamento em **Neon Postgres** e entrega de e-mail via **Resend**. As demais stories estão em spec/planejamento.

---

## 📖 Como ler a documentação (ordem recomendada)

Os documentos foram escritos em camadas — do **porquê** ao **como**. Leia nesta ordem para entender o escopo por inteiro sem se perder:

| # | Documento | Camada | O que você entende aqui |
|---|-----------|--------|-------------------------|
| 1 | [`estrategia-evento-experiencia-scale-club.md`](estrategia-evento-experiencia-scale-club.md) | **Por quê** (estratégia) | A tese central, os 9 conceitos estratégicos e as implicações acionáveis. É a origem de tudo. **Comece aqui.** |
| 2 | [`epic-8-plataforma-evento-lancamento.md`](epic-8-plataforma-evento-lancamento.md) | **O quê** (produto/escopo) | O épico completo: as 11 stories (8.1 → 8.11), o recorte do MVP, critérios de sucesso e o sequenciamento por ROI. **O mapa do escopo.** |
| 3 | [`design.md`](design.md) | **Como parece** (design) | O design system (estética *pixel art / RPG retrô* estilo Codédex): paleta, tipografia, componentes e tokens CSS. |
| 4 | [`specs/epic-8/8.1-magic-link/spec.md`](specs/epic-8/8.1-magic-link/spec.md) | **Como se constrói** (SDD) | A spec técnica da primeira story (Magic Link): decisões, contratos de API, modelo de dados, segurança e critérios de aceite. |
| 5 | [`specs/epic-8/8.1-magic-link/plan.md`](specs/epic-8/8.1-magic-link/plan.md) | **Plano de execução** | O plano de implementação task-a-task (TDD) da versão original em arquivo. |
| 6 | [`specs/epic-8/8.1-magic-link/plan-neon-resend.md`](specs/epic-8/8.1-magic-link/plan-neon-resend.md) | **Plano de migração** | A migração do storage em arquivo para **Neon Postgres** + entrega por e-mail via **Resend** (estado atual do código). |
| 7 | [`specs/epic-8/8.4-aulas/spec.md`](specs/epic-8/8.4-aulas/spec.md) | **Spec (próxima story)** | A spec da Story 8.4 (Aulas): embed do YouTube, disponibilidade por horário e rastreamento de visualização por lead. |

### Material-fonte (opcional — só se quiser ir à raiz da estratégia)

Estes são os insumos brutos que **deram origem** ao documento nº 1. Não precisa ler para entender o escopo — consulte se quiser a fonte primária:

| Documento | O que é |
|-----------|---------|
| [`texto-das-imagens.txt`](texto-das-imagens.txt) | Transcrição das telas/slides do produto de referência (Scale/Scaled Club da Rocket City): indicações, aulas, feed, métricas, lead scoring, admin. |
| [`yt-sgcvKcAZoZk-transcript.txt`](yt-sgcvKcAZoZk-transcript.txt) | Transcrição completa (~83 min) da demo/reunião que apresentou a plataforma de referência. |
| [`yt-sgcvKcAZoZk-transcript-timestamps.txt`](yt-sgcvKcAZoZk-transcript-timestamps.txt) | A mesma transcrição, com marcações de tempo. |

### Resumo do fluxo de leitura

```
Material-fonte (opcional)                    Documentos do projeto
────────────────────────                    ─────────────────────
texto-das-imagens.txt      ─┐
yt-…-transcript.txt         ├──►  1. estrategia (POR QUÊ)
yt-…-transcript-timestamps ─┘            │
                                         ▼
                                  2. epic-8 (O QUÊ / escopo)
                                         │
                                         ▼
                                  3. design.md (COMO PARECE)
                                         │
                                         ▼
                                  4–6. specs 8.1 (COMO CONSTRUIR)  ──►  código
                                         │
                                         ▼
                                  7. spec 8.4 (próxima story)
```

---

## 🗂️ Estrutura do repositório

```
dobro-club/
├── README.md                       ← você está aqui
│
├── estrategia-…-scale-club.md      ← documentação: POR QUÊ (estratégia)
├── epic-8-…-lancamento.md          ← documentação: O QUÊ (épico / 11 stories)
├── design.md                       ← documentação: design system
├── texto-das-imagens.txt           ← material-fonte (telas de referência)
├── yt-sgcvKcAZoZk-transcript*.txt  ← material-fonte (transcrição da demo)
│
├── specs/epic-8/                   ← specs por story (SDD)
│   ├── 8.1-magic-link/  (spec + plan + plan-neon-resend)
│   └── 8.4-aulas/       (spec)
│
├── server/                         ← backend Express (API :3001)
│   ├── app.js          — rotas + middleware
│   ├── db.js           — pool Neon Postgres
│   ├── events.js       — evento + verificação de API key
│   ├── leads.js        — ingestão idempotente de leads + revogação
│   ├── email.js        — envio do magic link (Resend)
│   ├── webhook.js      — webhook de inscrição
│   ├── validate.js · ratelimit.js
│   └── auth/           — token.js (magic link) · session.js (cookie HMAC)
│
├── dashboard/                      ← frontend React + Vite (mobile-first)
│   └── src/  — App.jsx · auth/AuthContext.jsx · pages/ (EventHome, SurveyPage, LinkInvalido)
│
├── scripts/                        ← db-init.js · seed.js · magic-link.js
├── tests/server/                   ← testes (Vitest + supertest, pg-mem offline)
├── server.js                       ← entrypoint da API
├── vite.config.js · package.json · .env.example
```

---

## 🧭 Stack

- **Backend:** Node (ESM) + Express — API na porta `3001`.
- **Banco:** Neon Postgres (driver `pg`); testes rodam offline com `pg-mem`.
- **E-mail:** Resend (entrega do magic link).
- **Frontend:** React 19 + Vite + React Router — mobile-first, tema dark.
- **Testes:** Vitest + supertest (server) / Testing Library + jsdom (front). Abordagem **TDD**.

---

## 🚀 Rodando localmente

Pré-requisitos: Node 18+ e um banco Neon (ou string de conexão Postgres).

```bash
# 1. Instale as dependências
npm install

# 2. Configure o ambiente
#    Copie .env.example para .env e preencha DATABASE_URL, RESEND_API_KEY, etc.
cp .env.example .env

# 3. Crie o schema e um evento de demonstração
npm run db:init
npm run seed          # cria evt_demo (api key: demo-key)

# 4. Suba API + frontend juntos
npm run dev           # server :3001 + vite

# Gere um magic link de teste
npm run link -- "Teste" teste@exemplo.com
```

Rodando os testes:

```bash
npm test              # suíte completa (offline, via pg-mem)
```

### Fluxo do Magic Link (Story 8.1)

```
[Captação externa] ──POST /api/events/:id/leads──► [Dobro Club]
                                                        │ cria lead + token opaco
                                                        ├─► e-mail (Resend) com o link
                                                        └─► webhook de inscrição
                                                        │
  lead clica ──► GET /entrar/:token ──► cookie de sessão ──► /e/:slug (home logada)
```

---

## 📌 Onde o escopo está hoje

- **8.1 Magic Link** — ✅ implementado (Neon + Resend).
- **8.2 Pesquisa-gate** — 🚧 em andamento (existe `SurveyPage` no front; spec ainda não versionada).
- **8.4 Aulas** — 📝 spec pronta (*Design Review*), implementação pendente.
- **8.3, 8.5–8.11** — descritas no épico, ainda não especificadas.

Consulte o [épico](epic-8-plataforma-evento-lancamento.md) para o sequenciamento completo por ROI.
