# Quickstart / Validação: Acesso pré-ingresso (Story 8.12)

Guia de validação ponta a ponta. Detalhes de campos em [data-model.md](./data-model.md) e
[contracts/evento-api.md](./contracts/evento-api.md). Não contém implementação — só como provar que a
feature funciona.

## Pré-requisitos

- Base `lib/` da 8.1/8.3 portada (já no repo): `db`, `leads`, `events`, `ingresso`, `ticket`,
  `engagement`, `auth/session`.
- Coluna `events.week_starts_at` aplicada por `initSchema` (idempotente).
- `.env` de dev opcional (Cloudinary); sem ele, `ticket.imageUrl` cai no template local (herdado 8.3).

## Rodar testes (TDD — devem ser escritos e falhar primeiro)

```bash
npm test -- ingresso.phase evento.route survey-gate
```

Esperado após implementação: **verde**. Cobertura mínima:
- `ingresso.phase.test.ts`: `provisoria` (now < janela), `oficial` (now ≥ janela), `weekStartsAt=null`
  ⇒ `provisoria`, borda exata em `windowOpensAt`.
- `survey-gate.test.ts`: `hasCompletedSurvey` true/false lendo `engagement_events(survey.completed)`.
- `evento.route.test.ts`: 401 sem sessão; payload com `phase/ticket/windowOpensAt/surveyAnswered`;
  emite `hub.viewed`; acessos repetidos não duplicam credencial.

## Cenários de aceitação (mapeados às user stories)

### US1 — Entrar antes do ingresso (P1)
1. Criar evento com `weekStartsAt` no futuro (> 3 dias) e um lead com sessão.
2. `GET /api/evento` ⇒ `200`, `phase: "provisoria"`, `ticket` presente, `windowOpensAt` no futuro.
3. Abrir `app/evento` ⇒ hub renderiza a credencial provisória (mobile 375–430px) e a contagem.
4. Repetir o `GET` ⇒ nenhuma credencial nova (derivada; INV-2).

### US2 — Convergência para o ingresso oficial (P2)
1. Ajustar `weekStartsAt` para ≤ 3 dias à frente (janela aberta) — ou usar `now` além de
   `windowOpensAt` no teste.
2. `GET /api/evento` ⇒ `phase: "oficial"`; hub mostra o ingresso oficial no lugar da credencial.
3. Lead **novo** criado já dentro da janela ⇒ `phase: "oficial"` direto (sem passo provisório).

### US3 — Gate da pesquisa (P3)
1. Lead **sem** `survey.completed` ⇒ `surveyAnswered: false`; hub bloqueia o conteúdo e oferece
   caminho para a pesquisa.
2. Emitir `survey.completed` para o lead ⇒ `GET /api/evento` ⇒ `surveyAnswered: true`; conteúdo
   deixa de estar bloqueado.

### Edge cases
- `weekStartsAt = null` ⇒ `phase: "provisoria"`, `windowOpensAt: null`, hub sem promessa de data.
- Sessão ausente/revogada ⇒ `401`/`404`, sem vazar dados de lead (SC-005).

## Validação manual (opcional)

```bash
npm run dev
# autenticar via magic link (app/entrar/[token]) para obter dc_session, então:
# abrir http://localhost:3000/evento no viewport mobile (DevTools 390px)
```

Conferir: credencial/ingresso conforme a data do evento, contagem para a janela, e bloqueio de
conteúdo enquanto a pesquisa não foi respondida.
