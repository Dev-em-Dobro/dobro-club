<!--
SYNC IMPACT REPORT
Version change: 1.0.0 → 2.0.0
Bump rationale: MAJOR — redefinição incompatível da stack (React+Vite + Express → Next.js full
  em TypeScript, com o Next assumindo o backend). Invalida o mandato de stack anterior.
Modified principles:
  - V. Test-First / TDD — remove `supertest` (Express-específico); testes de borda passam a
    exercitar Route Handlers do Next; `vitest + pg-mem` mantidos.
  - VI. Convenções de Código pg-mem-safe — mecânica de auth/rota atualizada para Next
    (cookie `dc_session` via `cookies()` do Next; `X-Api-Key` em Route Handlers admin);
    camada de dados framework-agnostic mantida (`query()`, `newId`, sem FK); TypeScript.
Redefined sections:
  - Restrições Técnicas & Stack — Frontend/Backend agora Next.js (App Router) + TS; Express retirado.
Added: nota de linguagem (TypeScript) e mecânica Route Handlers/Server Actions.
Removed sections: none
Migration impact:
  - 8.1 (magic link), 8.2 (pesquisa), 8.4 (aulas) foram construídas em React+Vite + Express e
    exigem migração em esforço separado (specs/tasks próprios). Permanecem válidas até migradas.
  - 8.3 (ingresso) será re-planejada para Next.js (plan/research/contracts/tasks). A Foundational da
    8.3 porta o núcleo compartilhado da 8.1 para `lib/` + `app/entrar/[token]`.
  - Transição SEM coexistência de runtimes: nada de proxy Next→Express nem dois servidores. As rotas
    legadas são reimplementadas como Route Handlers. O Express só é aposentado no **cutover de
    produção**, gated em 8.1(portada)/8.2/8.4 já em Next (ver plan.md §"Transição da Stack").
Templates reviewed:
  - .specify/templates/plan-template.md ✅ (Constitution Check lê em runtime; sem hardcode a atualizar)
  - .specify/templates/spec-template.md ✅ (agnóstica de stack)
  - .specify/templates/tasks-template.md ✅ (TDD mantido; paths ajustados por feature)
Follow-up TODOs:
  - Atualizar CONTRIBUTING.md (§5 convenções, §6 como rodar) para Next.js/TS — fora deste arquivo.
-->

# Dobro Club Constitution

Ambiente oficial de evento de lançamento (Epic 8). Estes princípios são **não-negociáveis**
e prevalecem sobre conveniência de implementação. Detalhamento operacional em
[`CONTRIBUTING.md`](../../CONTRIBUTING.md) e no épico
[`epic-8-plataforma-evento-lancamento.md`](../../epic-8-plataforma-evento-lancamento.md).

## Core Principles

### I. Mobile-First Premium (NÃO-NEGOCIÁVEL)
O participante vive o evento no celular; o desktop é secundário. Toda tela MUST ser desenhada
e validada **primeiro no mobile** (375–430px), com alvos de toque ≥44px, transições a 60fps sem
layout shift, navegação por bottom-nav/sheets (não menus desktop), safe-areas respeitadas e
comportamento PWA (add-to-home, sem app nativo). A experiência MUST funcionar para público leigo,
inclusive 45–60+. "Responsivo como adaptação do desktop" é proibido — o mobile **é** o produto.
*Rationale:* a tese do produto é "a experiência morreu, não o lançamento" — a fricção no celular mata a conversão.

### II. Acesso Sem Fricção — Magic Link (NÃO-NEGOCIÁVEL)
O acesso MUST ser por magic link sem senha: token opaco armazenado e **revogável**, sessão
persistente no navegador, mesmo link reutilizável em e-mail/WhatsApp. Nenhum fluxo pode exigir
senha, cadastro com formulário interno ou etapa que quebre o "clicou → já está dentro".
*Rationale:* cada passo de login perde leads, especialmente o público menos técnico.

### III. Ambiente Único e Sem Distração
Tudo do evento MUST viver dentro da plataforma; nada pode redirecionar o participante para fora
(WhatsApp/Drive/Zoom/YouTube externo/checkout espalhado). O menu do participante MUST ser mínimo
(Aulas, Comunidade, Feed, Ingresso, Indicações, Certificado). Nenhuma feature pode introduzir
distração que tire o usuário do evento.
*Rationale:* centralização é a proposta de valor central contra o tool-sprawl.

### IV. Tudo é Mensurado — Eventos + Webhooks (NÃO-NEGOCIÁVEL)
Cada ação relevante do usuário MUST emitir um evento de engajamento (`emit()` → tabela
`engagement_events`) que alimenta métricas por usuário e é reexposto via **webhook** para
automações externas (ManyChat/SendFlow/n8n). Uma feature de superfície (aula, ingresso, indicação)
MUST apenas *emitir* eventos; consumidores (lead scoring, admin) MUST apenas *consumir* — o único
acoplamento permitido entre features é o contrato de eventos (ver `CONTRIBUTING.md §3`).
*Rationale:* personalizar no momento do evento (não 15 dias depois) e desacoplar os dois trilhos de trabalho.

### V. Test-First / TDD (NÃO-NEGOCIÁVEL)
Teste antes da implementação. Regras de negócio e rotas MUST ter teste (vitest + pg-mem) escrito
primeiro, falhando, e só então implementado — a borda HTTP é exercitada invocando os **Route
Handlers** do Next diretamente (sem servidor real). `npm test` MUST estar verde em todo PR; nenhuma
feature entra na `main` com teste vermelho ou sem cobertura da regra nova.
*Rationale:* o piloto roda um lançamento real de ponta a ponta — regressão silenciosa custa a receita do evento.

### VI. Convenções de Código pg-mem-safe
O schema que roda em teste MUST ser compatível com pg-mem: IDs de texto via `newId('prefix')`
(nunca UUID), **sem** foreign keys, **sem** colunas `GENERATED` e **sem** índice parcial —
derivados (duração, tipo, nível) são calculados em TypeScript. A camada de dados MUST ser
**framework-agnostic** (módulos puros, testáveis com pg-mem, sem depender de Next): toda query MUST
passar por `query()` (`lib/db.ts`); DB é snake_case e TS é camelCase, mapeados na borda. Auth MUST
seguir o tipo de rota: cookie `dc_session` (via `cookies()` do Next) para endpoints de lead, header
`X-Api-Key` para Route Handlers de admin/ingestão. Efeitos externos (webhook, e-mail) MUST ser
best-effort e NUNCA bloquear a resposta.
*Rationale:* testes sem banco real exigem um subconjunto de SQL portátil e uma camada de dados
independente do framework; divergir aqui quebra a suíte e desalinha os trilhos.

### VII. Spec-Driven Development
Toda story MUST passar pelo fluxo Spec Kit: `specify` → `plan` → `tasks` → `implement`, com os
artefatos versionados em `specs/epic-8/<story>/`. Código de feature não começa sem spec aprovado.
*Rationale:* dois desenvolvedores em paralelo precisam de contratos escritos, não acordos verbais.

## Restrições Técnicas & Stack

- **Framework:** **Next.js (App Router) em TypeScript** — casca web e backend no mesmo app, servido
  single-origin. React 19, tema dark Tailwind, mobile-first.
- **Backend/API:** **Route Handlers** (`app/api/**/route.ts`) e **Server Actions** do Next; o
  magic link e a auth por cookie `dc_session` vivem no Next. (Express aposentado.)
- **Camada de dados:** módulos framework-agnostic (`lib/`) com `query()` sobre PostgreSQL (Neon) via
  `DATABASE_URL`; testes usam **pg-mem** em memória.
- **Vídeo:** embed YouTube (live + gravação). **Mensageria:** WhatsApp/e-mail e automações via webhook.
- **Fora de escopo (v1):** app nativo, web push como canal primário, scoring por resposta de pesquisa.

## Fluxo de Desenvolvimento

- **Dois trilhos paralelos** (ver `CONTRIBUTING.md §1`): A — Dados & Engajamento (8.2→8.8→8.9);
  B — Crescimento & Conteúdo (8.3→8.4→8.7). Trilhos não importam código um do outro.
- **Fase 0 compartilhada** (auth, camada de dados, emissor de eventos, casca do admin) MUST estar
  na `main` antes de qualquer feature branch.
- **Trunk-based leve:** `main` protegida, feature branch curta por story, **review cruzado**
  obrigatório em PR, rebase diário na `main`.

## Governance

Esta constituição prevalece sobre outras práticas do projeto. Emendas MUST ser documentadas neste
arquivo com bump de versão semântico (MAJOR: remoção/redefinição incompatível de princípio; MINOR:
novo princípio ou expansão material; PATCH: clarificação/redação). Todo PR e review MUST verificar
conformidade com estes princípios; complexidade que os contrarie MUST ser justificada ou recusada.
Orientação de desenvolvimento em runtime vive em [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

**Version**: 2.0.0 | **Ratified**: 2026-07-01 | **Last Amended**: 2026-07-01
