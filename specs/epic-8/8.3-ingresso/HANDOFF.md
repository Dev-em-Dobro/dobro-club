# HANDOFF — Story 8.3 Ingresso + Migração para Next.js

**Data:** 2026-07-01 · **Branch:** `feat/8.3-ingresso` (NÃO commitado ainda — tudo em working tree)

> Leia junto: [spec.md](./spec.md), [plan.md](./plan.md), [tasks.md](./tasks.md),
> [research.md](./research.md), [data-model.md](./data-model.md),
> [contracts/ingresso-api.md](./contracts/ingresso-api.md) e a Constituição
> `.specify/memory/constitution.md` (**v2.0.0**).

---

## 1. Decisão de arquitetura (a mais importante)

O projeto **migrou de React+Vite+Express → Next.js (App Router) + TypeScript**, com o **Next
assumindo o backend** (Route Handlers). Constituição emendada para **v2.0.0**. Migração **sem
coexistência de runtimes** (nada de proxy Next→Express); o Express só é aposentado no **cutover**,
quando 8.1(portada)/8.2/8.4 estiverem em Next.

- `npm run dev` → **Next** (`next dev`). `npm run dev:legacy` → app antigo (Vite+Express).
- Código legado **intacto**: `dashboard/`, `server/`, `server.js`, `scripts/` (rodam via `:legacy`).

## 2. O que JÁ foi implementado (working tree, verificado com `tsc` + `next build`)

### Setup Next+TS
- `package.json` (Next 15, TS 5, Tailwind v4 via `@tailwindcss/postcss`, `qrcode`, `@types/pg`).
  **Removida a devDependency `spec-kit`** (apontava p/ repo sem `package.json`, travava `npm install`).
  Scripts principais → Next; legado preservado com sufixo `:legacy`.
- `tsconfig.json` (strict; exclui `dashboard/`, `server/`, `scripts/`), `next.config.mjs`,
  `postcss.config.mjs`, `next-env.d.ts`.
- `app/globals.css` (tema dark), `app/legacy-shell.css` (copiado de `dashboard/src/styles.css`).
- `.env.example` (+ Cloudinary `NEXT_PUBLIC_CLOUDINARY_*`, `NEXT_PUBLIC_BASE_URL`).
- `.gitignore` (+ `.next/`, `coverage/`, `.vercel`, `*.pem`; usuário adicionou `docs/`, `CLAUDE.md`).
- `public/sprites/*` (copiado de `dashboard/public/sprites`).

### Base `lib/` portada (TS, framework-agnostic, pg-mem-safe)
- `lib/db.ts` — `query`/`setPool`/`SCHEMA`/`initSchema`. Schema já com colunas **`photo_url`,
  `referrer_lead_id`** em `leads` + tabela **`engagement_events`** (contrato §3).
- `lib/auth/token.ts` (`generateToken`, `buildMagicLink`), `lib/auth/session.ts`
  (`signSession`/`verifySession`, `COOKIE='dc_session'`, `COOKIE_MAX_AGE`).
- `lib/validate.ts` (`validateLeadInput`).
- `lib/ratelimit.ts` — **reescrito** (fixed-window in-memory + `clientIp`) porque `express-rate-limit`
  não serve em Route Handler.
- `lib/email.ts` (`sendMagicLinkEmail`, Resend), `lib/webhook.ts`
  (`fireInscriptionWebhook` + **`fireEngagementWebhook`** novo).
- `lib/events.ts` (`getEvent`, **`getEventBySlug`** novo, `verifyApiKey`).
- `lib/leads.ts` (`createOrGetLead` idempotente e-mail|telefone, **`getLeadByEmail`/`setPhoto`/
  `setReferrer`** novos, `mapLead` com `photoUrl`/`referrerLeadId`).
- `lib/engagement.ts` — **`emit(eventId, leadId, type, data)`**: persiste + webhook best-effort.

### Casca migrada (Route Handlers + páginas) — a "versão antiga" rodando em Next
- `app/entrar/[token]/route.ts` (magic link → seta cookie `dc_session` → redirect `/e/[slug]`).
- `app/api/me/route.ts`, `app/api/auth/logout/route.ts`.
- `app/api/events/[eventId]/leads/route.ts` (criar lead, admin `X-Api-Key`) e
  `app/api/events/[eventId]/leads/[leadId]/revoke/route.ts`.
- `components/AuthContext.tsx` (`AuthProvider`/`useAuth`, client), `components/EventHome.tsx`,
  `components/LinkInvalido.tsx`.
- `app/page.tsx` e `app/e/[slug]/page.tsx` → `EventHome`; `app/link-invalido/page.tsx`.

**Verificação:** `npx tsc --noEmit` ✅ · `npx next build` ✅ (9 rotas) · `next dev` serve `/` e
`/link-invalido` com HTTP 200 (numa porta limpa).

### SDD já pronto
- Constituição **v2.0.0**; `CONTRIBUTING.md` §3 atualizado (**`referral.signup` emitido por 8.3**,
  consumido por 8.7). `spec.md` com 18 FRs + clarifications (Q1/Q2/Q3) + checklist 16/16.
  `tasks.md` com 43 tasks (T001–T004 marcadas `[X]`). Análise `/speckit-analyze`: 0 CRITICAL, 0 HIGH.

## 3. O que FALTA implementar (próximos passos, em ordem)

1. **Portar a suíte de testes p/ `lib/` (TS)** — hoje `tests/server/*.test.js` testam os módulos
   antigos `server/*.js`. Reescrever como `tests/*.test.ts` batendo em `lib/` (vitest + pg-mem).
   **Débito de TDD da Fase 0.** A config do vitest vive em `vite.config.js` (`root:'.'`, env node +
   opt-in jsdom por header `// @vitest-environment jsdom`).
2. **8.3 US1 (ingresso)** — MVP:
   - `lib/ticket.ts` (`buildTicketImageUrl` via Cloudinary; avatar default), `lib/ingresso.ts`.
   - `app/api/e/[slug]/ingresso/route.ts` (POST público: rate limit + `validateLeadInput` +
     `createOrGetLead` + `setPhoto` + magic link + retorna `magicLink`+`ticket`).
   - `app/api/e/[slug]/ingresso/recuperar/route.ts` (reenvio por e-mail, **resposta neutra**).
   - `components/IngressoForm.tsx` (form + upload não-assinado Cloudinary + consent + `?ref=`),
     `app/ingresso/page.tsx`, `app/ingresso/pronto/page.tsx` (exibe magic link), `app/recuperar-link/page.tsx`.
   - Limites de foto: **≤5MB, JPEG/PNG/WebP** (FR-015). Testes **antes** (TDD).
3. **8.3 US2 (compartilhar + QR)** — `lib/ticket.ts` `qrValue`+canvas, `components/TicketCard.tsx`,
   `app/api/ingresso/share/route.ts` (emite `ticket.shared`).
4. **8.3 US3 (indicação)** — `resolveReferrer` em `lib/ingresso.ts`, estende o route de geração p/
   gravar `referrer_lead_id` + emitir `referral.signup` (ignora self/inexistente).
5. **8.2 SurveyPage** — migrar `dashboard/src/pages/SurveyPage.jsx` → `app/pesquisa/[slug]/page.tsx`
   (usa react-router hoje; trocar por `next/navigation`). Esforço próprio.
6. **Cutover** — quando houver paridade: remover `dev:legacy`, `dashboard/`, `server/`, `server.js`,
   `vite.config.js` e deps Vite/Express.

## 4. Gotchas / avisos para a próxima sessão

- **Nada foi commitado.** Tudo está na working tree da branch `feat/8.3-ingresso`.
- **`npm install` / `next build` / `next dev` precisam de rede** → rodar com sandbox desabilitado.
- Erro `Cannot find module './NNN.js'` (webpack-runtime) = cache `.next` sujo por misturar
  `next build` + `next dev`. Fix: **`rm -rf .next`**. Evitar `next build` na árvore durante dev.
- **NÃO re-adicionar `spec-kit`** ao package.json (é a ferramenta em `.specify/`, não pacote npm).
- Para logar de verdade (`/api/me`, `/entrar/[token]`) precisa de **`DATABASE_URL`** no `.env`.
  Testes usam **pg-mem** (sem banco).
- **Contrato de eventos §3 é FROZEN.** Tipos desta story: `ticket.shared` e `referral.signup`.
- Route Handlers (Next 15): params são **`Promise`** → `const { x } = await ctx.params`.
- Foundational (porte + schema + emissor) deveria ser **PR próprio** com review cruzado (decisão F3).
