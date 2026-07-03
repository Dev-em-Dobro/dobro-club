# Handoff — Implementação da Story 8.14 (conteúdos dia-1)

> Branch: `feat/8.14-conteudos-dia-1` (empilhada na `feat/8.12-acesso-pre-ingresso`).
> "O que falta" = tarefas sem `[X]` em [tasks.md](./tasks.md). Rodar `npm test` para reconfirmar.

**Status**: ✅ **COMPLETO** — 22/22 tarefas. `npm test` 27 arquivos / 99 testes verdes. `tsc --noEmit` limpo.

## Entregue

**Foundational**
- `lib/db.ts` — tabela `content_items` + índices; **seed mock de 3 aulas de nivelamento** (embed
  YouTube: `JHhUSTsZj7Q`, `_DDvXYJ6Az4`, `uxln1hT_Ev4`) no fallback dev (`seedDemoContent`).
- `lib/content.ts` — `ContentKind`, `ContentItem`, `isReleased` (drip), `listContentItems`,
  `getContentItem`, `createContentItem`. `tests/content.release.test.ts` (5).
- `lib/engagement.ts` — `'content.opened'` na taxonomia FROZEN.
- `app/api/events/[eventId]/conteudo/route.ts` — ingestão admin `X-Api-Key`. `tests/conteudo.ingest.test.ts` (6).

**US1/US2/US3 — conteúdo no hub**
- `GET /api/evento/conteudo` — lista com `available = gate × release`, **sem vazar `resource`**.
- `POST /api/evento/conteudo/[id]/abrir` — revalida gate+release, emite `content.opened`, devolve
  `resource` (+`external:true` p/ codequest). `tests/conteudo.route.test.ts` (4) + `conteudo.abrir.test.ts` (7).
- `components/ConteudoDia1.tsx` + `app/evento/conteudo/page.tsx` — 3 seções (aulas embed / docs+presente / CodeQuest nova aba); gate bloqueia tudo.
- `components/EventoHub.tsx` (8.12) — CTA "Ir para o conteúdo" → `/evento/conteudo`.
- `app/legacy-shell.css` — estilos `.content-*`, `.badge-gift`.

**Polish**
- `CONTRIBUTING.md §3` — `content.opened` (emite=8.14) registrado.

## Notas / recomendado (não bloqueia)
- **Mock**: as 3 aulas só aparecem no fallback dev (sem `DATABASE_URL`). Em produção, provisionar via
  `POST /api/events/<eventId>/conteudo` (`X-Api-Key`). Substituir/expandir quando os vídeos finais chegarem.
- **Gate no dev**: como a pesquisa (8.2) ainda é Express, no dev Next o `survey.completed` não é
  emitido — o conteúdo fica bloqueado até existir esse evento para o lead. Para ver o mock, emitir
  `survey.completed` para o lead de teste.
- **QA visual em dispositivo** do `/evento/conteudo` a 375–430px — feito estruturalmente (embed 16:9,
  alvos ≥44px), sem render real neste ambiente.
- **CodeQuest**: abre em nova aba (exceção à Constituição III, registrada no plan §Complexity).
