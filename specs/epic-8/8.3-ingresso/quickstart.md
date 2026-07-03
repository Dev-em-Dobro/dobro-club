# Quickstart & Validação: Ingresso/Credencial com indicação por QR (Story 8.3)

Guia para rodar e **validar** a feature ponta a ponta. Detalhes de entidade e endpoint estão em
[data-model.md](./data-model.md) e [contracts/ingresso-api.md](./contracts/ingresso-api.md).

**Stack**: Next.js (App Router) + TypeScript (Constituição v2.0.0).

## Pré-requisitos

```bash
npm install
# novas deps desta story:
npm install qrcode
# .env: DATABASE_URL; Cloudinary (CLOUDINARY_CLOUD_NAME + upload preset não assinado por evento + template)
npm run db:init      # aplica schema (leads +colunas, engagement_events) via lib/db.ts
npm run seed         # evento de exemplo + template Cloudinary configurado
```

## Rodar

```bash
npm run dev          # next dev (single-origin: páginas + Route Handlers)
```

## Rodar os testes (TDD — Constituição V)

```bash
npm test             # vitest + pg-mem (sem banco real, sem servidor)
npm run test:watch
```

**Escreva o teste antes** de cada regra/rota. A borda HTTP é testada **importando e invocando** o
Route Handler com um `Request`. Arquivos novos:
`tests/ingresso.route.test.ts`, `tests/engagement.test.ts`, `tests/ingresso.recuperar.test.ts`,
`tests/ingresso.share.test.ts`.

---

## Cenários de validação (mapeados às User Stories)

### US1 — Gerar ingresso e entrar (P1)

1. Abrir a tela pública de ingresso no **mobile** (375–430px).
2. Preencher nome/e-mail/telefone, marcar consentimento, manter avatar padrão, gerar.
3. **Esperado**: ingresso exibido com o nome; magic link enviado por e-mail; abrir o link entra no
   evento como o participante (sessão `dc_session`).
4. Confirmar que a **tela pós-geração exibe o magic link** na mesma sessão (FR-005).
5. Repetir com o **mesmo e-mail ou telefone** → nenhum lead duplicado (idempotência, SC-003).
6. Refazer escolhendo **enviar foto** → ingresso mostra a foto no lugar do avatar.
7. **Recuperação**: em outro aparelho, abrir "esqueci meu link", informar o e-mail cadastrado →
   link **reenviado por e-mail**, resposta **neutra** na tela; informar e-mail **não** cadastrado →
   mesma resposta neutra, sem vazar existência e sem exibir link (FR-017/FR-018).

- Cobre: FR-001..FR-005, FR-013..FR-018 · SC-001, SC-003.

### US2 — Compartilhar com QR (P2)

1. Com um ingresso gerado, acionar **baixar** → PNG contém um QR code.
2. Acionar **compartilhar** (ex.: WhatsApp) → `POST /api/ingresso/share {channel}` registra
   `ticket.shared` e dispara o webhook (best-effort).
3. Escanear o QR baixado → cai na tela pública de geração, **não** loga como o dono (SC-006).

- Cobre: FR-006, FR-007, FR-011 · SC-002, SC-006.

### US3 — Chegar por indicação (P3)

1. Abrir `/ingresso?ref=<leadId-do-João>` e gerar um ingresso novo (Maria).
2. **Esperado**: lead da Maria com `referrer_lead_id = João`; evento `referral.signup
   { referrerLeadId }` disponível; o QR do ingresso da Maria carrega `ref=<leadId-da-Maria>`.
3. Casos de borda: `ref` inexistente ou `ref` = próprio lead → lead criado **sem** atribuição.

- Cobre: FR-008, FR-009, FR-010, FR-012 · SC-004.

---

## Checklist de conformidade constitucional

- [ ] **Mobile-first**: telas validadas a 375–430px, toque ≥44px, sem layout shift.
- [ ] **Magic link**: acesso reusa `/entrar/:token`; QR/shareUrl **nunca** contêm o token.
- [ ] **Eventos**: `ticket.shared` e `referral.signup` persistidos em `engagement_events` + webhook.
- [ ] **pg-mem-safe**: `npm test` verde; ids texto, sem FK, sem índice parcial no caminho de teste.
- [ ] **Best-effort**: Cloudinary, e-mail e webhook não bloqueiam a resposta; falha de foto → avatar.
- [ ] **TDD**: cada rota/regra tem teste escrito primeiro, falhando, depois implementado.
