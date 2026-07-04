# Phase 0 — Research: Nivelamento com liberação progressiva por lead

Todas as incógnitas do Technical Context foram resolvidas. As decisões de produto (âncora, sem
exigência de conclusão, offset por item) já vieram travadas da spec (Clarifications 2026-07-03); aqui
consolidam-se as decisões **técnicas** de reúso e as bordas.

## D1 — Âncora de liberação = `leads.created_at`

- **Decisão**: usar `lead.createdAt` (já persistido, 8.1/8.15) como data de entrada do lead. Liberação
  de aula = `now >= createdAt + releaseOffsetDays * 1 dia`.
- **Rationale**: é o único carimbo de "entrou no evento" já disponível por lead; não exige novo dado nem
  nova tabela. Reúsa `getLeadById` que as rotas já chamam (custo zero de I/O extra).
- **Alternativas**: (a) coluna dedicada `entered_at` — redundante com `created_at` hoje; adia se um dia
  "entrada" divergir de "criação". (b) evento `lead.created`/onboarding como âncora — mais indireto e
  exigiria varrer engagement; rejeitado por complexidade.

## D2 — Onde mora a regra: `lib/content.ts` (função pura, pg-mem-safe)

- **Decisão**: adicionar em `lib/content.ts`:
  - `isLessonReleasedForLead(item, leadEntryDate, now)` — regra por-lead por offset.
  - `isItemReleasedForLead(item, leadEntryDate, now)` — **seletor de precedência**: `kind==='lesson'`
    ⇒ por-lead; senão ⇒ `isReleased(item, now)` (calendário 8.14, inalterado).
  - `releaseForLeadAt(item, leadEntryDate)` — data prevista (`entrada + offset`) para o rótulo "em
    breve"; `null` quando não se aplica (kind ≠ lesson ⇒ usa `releaseAt`).
- **Rationale**: mantém a regra framework-agnostic e testável isoladamente (Const. VI); as rotas viram
  só fiação. Espelha o padrão do `isReleased` já existente.
- **Alternativas**: calcular inline nas rotas — duplicaria lógica e escaparia do teste unitário puro;
  rejeitado.

## D3 — Precedência aula (por-lead) × calendário (8.14)

- **Decisão**: para `kind='lesson'`, o modo **por-lead prevalece** e o `release_at` é ignorado; para
  `doc`/`codequest`, nada muda (seguem `isReleased` por calendário). A coluna `release_at` **permanece**
  (não migramos dados nem removemos lógica).
- **Rationale**: satisfaz FR-010 com risco mínimo — a 8.14 continua verde para não-aulas; aulas passam a
  ter cadência por-lead. Evita migração destrutiva.
- **Alternativas**: um enum `release_mode` por item (`calendar|per_lead`) — mais flexível, porém mais
  superfície/estado e um NEEDS-config a mais; adia para quando houver caso real de aula por calendário.

## D4 — Default e saneamento de `releaseOffsetDays`

- **Decisão**: coluna `release_offset_days int` NULL-able; **default lógico = 0** quando `null`. Valores
  inválidos (negativos, `NaN`) são **saneados para 0** no cálculo (não travam nem liberam tudo).
- **Rationale**: sem config, a aula libera assim que passa o gate (não prende conteúdo por omissão);
  cadência real (0, 2, 5…) é curadoria. Default em TS respeita pg-mem-safe (sem DEFAULT no DDL).
- **Alternativas**: default 2 dias — poderia esconder a primeira aula de quem acabou de entrar;
  rejeitado (a aula 1 deve estar disponível de imediato).

## D5 — Degradação segura de `createdAt`

- **Decisão**: `leadEntryDate` ausente/inválida ⇒ tratar como **`now`** (entrada = agora). Efeito: só a
  aula de offset 0 fica liberada; as demais entram na trilha a partir de agora.
- **Rationale**: nunca travar todo o nivelamento por dado ruim (FR-013/SC-005), e nunca liberar tudo por
  engano. Consistente com o espírito "data inválida não trava conteúdo" do `isReleased` atual.
- **Alternativas**: bloquear tudo (frágil) ou liberar tudo (fura a cadência) — ambos rejeitados.

## D6 — Provisionamento do offset (sem admin UI)

- **Decisão**: estender `ContentInput` e a rota admin `POST /api/events/[eventId]/conteudo` (`X-Api-Key`)
  para aceitar `releaseOffsetDays`; alternativamente SQL direto. Sem tela.
- **Rationale**: mesmo padrão de provisionamento da 8.4/8.14/8.15; admin UI é a 8.9.
- **Alternativas**: nova rota dedicada — desnecessária; a rota de criação de conteúdo já é o ponto.

## D7 — Medição inalterada (`content.opened`)

- **Decisão**: manter a emissão `content.opened` no `POST .../abrir`, apenas **movida para depois** da
  revalidação por-lead. Nenhum tipo novo na taxonomia FROZEN.
- **Rationale**: Const. IV; score (8.17) e streak (8.18) consomem esse mesmo sinal. Abrir aula não
  liberada ⇒ 403 **antes** do `emit` (não polui a medição — SC-004).
- **Alternativas**: novo evento `lesson.unlocked` — fora de escopo; a liberação é derivável do tempo +
  offset, não precisa de evento próprio nesta story.

## Riscos & mitigação

- **Risco**: aula com `release_at` legado (8.14) e agora também tratada por offset ⇒ confusão. **Mit.**:
  precedência explícita (D3) + teste cobrindo aula com ambos definidos.
- **Risco**: fuso/borda de dia. **Mit.**: comparar por instante UTC (`getTime()`), sem lógica de
  meia-noite; formatação de data fica na UI.
- **Risco**: rota de lista é pública (visitante sem lead). **Mit.**: `available` já exige
  `authenticated && surveyAnswered`; `releaseForLeadAt` só calculado quando há `lead.createdAt`.
