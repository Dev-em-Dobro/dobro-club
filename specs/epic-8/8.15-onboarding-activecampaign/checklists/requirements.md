# Specification Quality Checklist: Onboarding via ActiveCampaign

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-03
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Reúso forte da 8.1 (ingestão + magic link + webhook de inscrição, já em Next). A story concentra a
  **fiação da ActiveCampaign** (mapeamento + provisionamento por evento) e o **onboarding de 1 clique**;
  boa parte é **configuração na AC**, não código novo.
- Bifurcações resolvidas em `/speckit-specify` (2026-07-03): AC chama o endpoint de ingestão existente;
  magic link personalizado via consumo do webhook `lead.created`; integração mão única (sem escrita na
  AC).
- Clarificações resolvidas em `/speckit-clarify` (2026-07-03): (1) só contatos que entram na
  lista/tag/estágio de qualificação do evento viram lead; (2) onboarding **email-only** (captação
  sempre coleta email → identidade canônica; WhatsApp fora); (3) **SC-007 = < 5 minutos**; (4) medir a
  origem AC reusando `lead.created` + `source`, **sem** novo tipo na taxonomia FROZEN.
- Item a confirmar no plano: se o formato de webhook de saída atual (`lead.created`) é consumível pela
  AC como está, ou se precisa de um pequeno ajuste/adaptador de payload.
