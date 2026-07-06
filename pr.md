# Funil de aquecimento: onboarding, nivelamento, lives, lead score e gamificação (8.15–8.19)

Entrega a cadeia de **aquecimento pré-evento** do Epic 8, cinco stories via Spec-Driven Development
(`specify → plan → tasks → implement`, TDD com vitest + pg-mem). Cada story tem artefatos versionados em
`specs/epic-8/<story>/` e um commit próprio.

**Branch:** `feat/8.19-streak-badges` · **Commits:** `8788580..2efc847` (5)

## Por que

Ligar a captação (Meta → ActiveCampaign) à plataforma e dar ao lead uma jornada de aquecimento medida e
gamificada — entrar logado, receber conteúdo no próprio ritmo, ter lives para voltar, e ser pontuado /
incentivado — para chegar ao evento mais preparado e priorizar o comercial no momento certo (não 15 dias
depois). O contrato de eventos (`CONTRIBUTING §3`) é o único acoplamento: features **emitem**, os
consumidores (score, gamificação) **consomem** (Constituição IV).

## O que muda, por story

| Story | Commit | Entrega |
|---|---|---|
| **8.15** Onboarding ActiveCampaign | `8788580` | Canal de onboarding por evento (`events.onboarding_channel`): no canal `active-campaign` a plataforma **não** envia o magic link (a AC envia), mas continua disparando o webhook `lead.created` com o `magicLink` — sem e-mail duplicado. |
| **8.16** Nivelamento progressivo | `3453efa` | Aulas de nivelamento liberam **por lead** (`lead.createdAt + release_offset_days`) em vez de data de calendário; "em breve" com data prevista por lead. Precedência: para `kind='lesson'` vale o modo por-lead; docs/CodeQuest seguem o calendário da 8.14. |
| **8.17** Lives de aquecimento (mock) | `b9ffac5` | Modelo próprio `lives` com **estado derivado do horário** (agendada → ao vivo → gravação → encerrada); assistir mede `live.opened`; agenda provisionável por `X-Api-Key`; painel mobile-first. Mock = embeds placeholder, trocáveis pelo streaming real na mesma tabela. |
| **8.18** Lead Score | `14407d3` | Pontuação de engajamento por **(lead, evento)** = soma de `peso[tipo] × contagem` dos `engagement_events`, **derivada na leitura**. Consulta de score+breakdown e ranking do evento por `X-Api-Key`. |
| **8.19** Streak & Badges | `2efc847` | **Streak** (dias consecutivos ativos, fuso UTC−3, tolerância hoje/ontem) e **badges** (catálogo de regras fixas) derivados dos eventos + lead score; painel no hub para o participante (`dc_session`) e consumo admin (`X-Api-Key`). |

## Como está construído

- **Camada de dados framework-agnostic e pg-mem-safe** (Const. VI): tudo em `lib/` via `query()`, ids
  texto, sem FK/GENERATED; derivados (liberação, estado da live, score, streak, badges) calculados **em
  TypeScript**; snake↔camel na borda.
- **Schema aditivo:** coluna `content_items.release_offset_days` (8.16) e tabela `lives` (8.17). Score,
  streak e badges **não** persistem — são derivados on-demand (sem tabela/coluna).
- **Contrato de eventos:** um tipo novo, `live.opened` (8.17), documentado em `CONTRIBUTING §3`. 8.18 e
  8.19 **consomem** e não emitem. Nenhum outro tipo alterado.
- **Bordas:** participante por cookie `dc_session`; admin/ingestão/consumo por `X-Api-Key`. Efeitos
  externos (webhook/e-mail) best-effort, nunca bloqueiam a resposta.
- **UI:** mobile-first (painéis de conteúdo, lives e gamificação no hub; sem redirecionar para fora —
  Const. III).

## Testes

- **TDD** (Const. V): teste escrito e falhando antes da implementação em todas as stories.
- Suíte completa **verde: 209 testes** (`npm test`) e **`tsc --noEmit` limpo**.
- Novos arquivos de teste: canal de onboarding e rota AC (8.15); regra por-lead e rotas de conteúdo
  (8.16); estado da live, rotas e provisionamento (8.17); regra/consulta/rotas de score (8.18);
  streak/badges puros e rotas (8.19). Route Handlers do Next exercitados diretamente sobre pg-mem.

## Como verificar

```bash
npm test          # 209 verdes
npx tsc --noEmit  # limpo
```

Roteiros ponta a ponta em cada `specs/epic-8/<story>/quickstart.md`.

## Fora de escopo / follow-ups registrados

- **"Dia ativo = assistiu ≥10%"** (streak mais fiel): exige um **evento de progresso** que o player ainda
  não emite → story futura de instrumentação (hoje o dia ativo usa `content.opened`/`live.opened`).
- **Badges persistidos** (com "conquistado em"/"novo!") e **pesos/limiares configuráveis por DB**:
  evolução futura (hoje tudo derivado e versionado no código).
- **Streaming real** das lives: troca dos embeds mock na mesma tabela `lives`.
- **Admin UI** (8.9) para provisionar conteúdo/lives/pesos: fora desta cadeia (hoje via `X-Api-Key`/SQL).
- Referências de numeração em specs anteriores citavam "8.17 lead score / 8.18 streak"; com as lives
  entrando como 8.17, viraram **8.18** (lead score) e **8.19** (streak) — ajuste cosmético pendente.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
