# Quickstart / Validação: Conteúdos dia-1 (Story 8.14)

Guia de validação ponta a ponta. Detalhes em [data-model.md](./data-model.md) e
[contracts/conteudo-api.md](./contracts/conteudo-api.md). Sem implementação aqui.

## Pré-requisitos

- Base `lib/` da 8.1/8.12 (já no repo): `db`, `events`, `leads`, `engagement` (com `hasCompletedSurvey`),
  `auth/session`.
- Tabela `content_items` aplicada por `initSchema` (idempotente).
- Hub da 8.12 (`app/evento`) disponível — o CTA passa a apontar para `/evento/conteudo`.

## Rodar testes (TDD — escrever e falhar primeiro)

```bash
npm test -- content.release conteudo.route conteudo.abrir conteudo.ingest
```

Cobertura mínima:
- `content.release.test.ts`: `isReleased` (null⇒liberado, futuro⇒bloqueado, borda).
- `conteudo.route.test.ts`: 401 sem sessão; `available` = gate×release; **`resource` nunca listado**.
- `conteudo.abrir.test.ts`: 403 `gated`/`not_released`; 200 devolve `resource`; emite `content.opened`.
- `conteudo.ingest.test.ts`: 401 sem `X-Api-Key`; 400 inválido; 201 cria.

## Cenários de aceitação (mapeados às user stories)

### US1 — Aulas de nivelamento (P1)
1. Admin cria item `kind=lesson` (`POST /api/events/[eventId]/conteudo` com `X-Api-Key`), `releaseAt`
   no passado.
2. Lead **com** `survey.completed` chama `GET /api/evento/conteudo` ⇒ vê a aula com `available:true`.
3. `POST .../conteudo/[id]/abrir` ⇒ `200` com `resource` (embed) e emite `content.opened`.
4. Aula com `releaseAt` futuro ⇒ `available:false` (aparece "em breve"); `abrir` ⇒ `403 not_released`.

### US2 — Docs / presentes (P2)
1. Admin cria `kind=doc` com `isGift:true`.
2. Lead que passou o gate lista ⇒ vê o doc; `abrir` devolve `resource` e mede.
3. **Sem** gate (`surveyAnswered:false`) ⇒ item `available:false` e `abrir` ⇒ `403 gated`; `resource`
   nunca aparece na listagem.

### US3 — Acesso ao CodeQuest (P3)
1. Admin cria `kind=codequest` com `resource` = URL externa.
2. Lead acessível ⇒ `abrir` ⇒ `200 { external:true, resource }`; front abre em **nova aba**.
3. Acesso emite `content.opened { kind:"codequest" }`.

### Edge cases
- Item sem `releaseAt` ⇒ liberado assim que o gate passa.
- Sem conteúdo cadastrado ⇒ hub degrada (seções vazias tratadas).
- Sessão ausente ⇒ `401`; item de outro evento ⇒ não listado/`404`.

## Validação manual (opcional)

```bash
npm run dev
# autenticar via magic link, então abrir http://localhost:3000/evento/conteudo (viewport mobile)
```

Conferir: gate bloqueia tudo até a pesquisa; itens "em breve" mostram data; CodeQuest abre em nova aba.
