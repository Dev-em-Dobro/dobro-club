# Implementation Plan: Onboarding via ActiveCampaign (lead da captação entra logado)

**Branch**: `feat/8.15-onboarding-activecampaign` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/epic-8/8.15-onboarding-activecampaign/spec.md`

**Stack**: **Next.js (App Router) + TypeScript** — Constituição v2.0.0.

## Summary

Liga o **ActiveCampaign** (fonte da captação: Meta → captura → AC) à plataforma **reusando a 8.1 já
portada em Next**: a automação da AC chama a **ingestão existente** (`POST /api/events/[eventId]/leads`,
`X-Api-Key`) quando um contato **entra na lista/tag de qualificação do evento**; a plataforma cria/acha
o lead (idempotente por email/telefone), monta o `magicLink` e **dispara o webhook de inscrição**
`lead.created` — que a AC consome para guardar o link e enviar o **e-mail de onboarding** (1 clique,
sem senha).

**O único net-new de código** resolve um conflito descoberto: hoje a ingestão **também envia o e-mail
de magic link pela própria plataforma** (`sendMagicLinkEmail`) quando `isNew`. Como agora **a AC** envia
o onboarding, sem tratamento haveria **e-mail duplicado**. A solução é um **canal de onboarding por
evento** (`events.onboarding_channel` ∈ `platform` | `active-campaign`, default `platform`): quando `active-campaign`, a
plataforma **não** envia o e-mail (a AC envia), mas **continua** disparando o webhook com o `magicLink`.
Resto é **configuração na AC** + provisionamento por evento (webhook_url + canal) + docs.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js. React 19 via Next.js (App Router).

**Primary Dependencies**: Next.js, `pg`; reúso de `lib/` (`db`, `events`, `leads`, `validate`,
`auth/token`, `email`, `webhook`). **Sem novas dependências externas.** A AC é a fonte externa (não é
dependência de código; comunica-se via a ingestão HTTP existente e via consumo do webhook de saída).

**Storage**: PostgreSQL (Neon) via `query()`; `pg-mem` nos testes. **Sem tabela nova.** **Uma coluna
nova** em `events`: `onboarding_channel text` (pg-mem-safe: text, sem FK/GENERATED, default em TS).

**Testing**: `vitest` + `pg-mem`. Route Handler `POST .../leads` exercitado invocando a função;
webhook/e-mail mockados para asserir "disparou / não disparou". Auth admin por `X-Api-Key`.

**Target Platform**: Web mobile-first (PWA), Next single-origin. Esta story é majoritariamente de
integração/backend; a única superfície visual é a **entrada por magic link** (já existe:
`/entrar/[token]` → hub 8.12).

**Performance Goals**: ingestão + webhook quase instantâneos; `magicLink` disponível ao lead em **< 5min**
da qualificação (SC-007) — a folga absorve a automação/e-mail da AC.

**Constraints**: efeitos externos (webhook, e-mail) **best-effort**, nunca bloqueiam a resposta
(Const. VI); idempotência por email/telefone (reúso `createOrGetLead`); e-mail/webhook só disparam em
`isNew`; camada de dados framework-agnostic e pg-mem-safe; `X-Api-Key` na ingestão.

**Scale/Scope**: 1 evento ativo, milhares de leads. **1 coluna + 1 Route Handler estendido + 1 helper
em `lib/events` + testes + docs.** Nenhuma tela nova.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (Constituição v2.0.0)

| Princípio | Gate | Status |
|-----------|------|--------|
| **I. Mobile-First Premium** | Sem tela nova; a entrada cai no hub 8.12 (já mobile-first) | ✅ atende (N/A de UI) |
| **II. Magic Link (sem senha)** | Núcleo: reúsa magic link, 1 clique, sem senha/cadastro interno | ✅ atende (reforça) |
| **III. Ambiente Único** | E-mail (AC) é canal de **entrega** permitido; o link traz o lead **para dentro** (não redireciona pra fora) | ✅ atende |
| **IV. Tudo é Mensurado** | Reúsa `lead.created` + `source` (sem novo tipo na taxonomia FROZEN) | ✅ atende |
| **V. Test-First / TDD** | Teste (vitest+pg-mem) antes; canal/webhook/e-mail asseridos por mock | ✅ atende |
| **VI. pg-mem-safe / camada agnostic** | Coluna `onboarding_channel` text/sem FK; regra em `lib/events`; `query()`; `X-Api-Key`; efeitos best-effort | ✅ atende |
| **VII. Spec-Driven** | Artefatos em `specs/epic-8/8.15-onboarding-activecampaign/` | ✅ atende |

**Sem violações.** Nenhuma entrada no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/epic-8/8.15-onboarding-activecampaign/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/onboarding-ac.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root) — Next.js App Router + TypeScript

```text
lib/                                      # camada framework-agnostic (pg-mem-safe, TS)
├── db.ts        # ESTENDER — coluna events.onboarding_channel text (bloco skippable/idempotente)
└── events.ts    # ESTENDER — mapear onboardingChannel + helper platformSendsOnboardingEmail(event)

app/api/events/[eventId]/leads/route.ts   # ESTENDER (8.1) — condicionar sendMagicLinkEmail ao canal;
                                          #   webhook lead.created continua disparando em isNew (com magicLink)

tests/
└── onboarding.activecampaign.route.test.ts  # NOVO — canal 'active-campaign' NÃO envia e-mail mas dispara webhook c/ magicLink;
                                             #   canal 'platform' (default) mantém e-mail; idempotência (isNew=false ⇒ nada refira)
```

**Provisionamento** (FR-006, sem admin UI — admin é 8.9): o evento é configurado por **config/DB**
(setar `webhook_url` = URL de entrada da AC e `onboarding_channel='active-campaign'`), no mesmo padrão da 8.4/8.14
(sem interface). Documentado no `quickstart.md`.

**Structure Decision**: **Next.js App Router em TypeScript**, single-origin. Reúso máximo da 8.1
(ingestão + magic link + webhook + revogação já em Next). A story adiciona **um discriminador de canal
de onboarding** no evento para evitar e-mail duplicado, mantendo o webhook como o meio de a AC obter o
`magicLink`. A "fiação" da AC (tag de qualificação → chamar ingestão; consumir webhook → guardar link →
enviar e-mail) é **configuração externa**, descrita em contracts/quickstart.

## Complexity Tracking

> Sem violações constitucionais — seção vazia.
