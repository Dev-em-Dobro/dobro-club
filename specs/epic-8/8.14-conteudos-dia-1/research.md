# Research: Conteúdos dia-1 (Story 8.14)

Resolve as incógnitas do Technical Context. Decisões framework-agnostic e pg-mem-safe.

---

## D1 — Modelo de dados: uma tabela com `kind` vs. três tabelas

**Decision**: **tabela única `content_items`** com discriminador `kind` (`lesson`|`doc`|`codequest`),
campos comuns (`title`, `description`, `resource`, `release_at`, `position`, `is_gift`, `event_id`).

**Rationale**: os três tipos compartilham o mesmo ciclo (gate + drip + listagem + medição); só o
significado de `resource` muda (embed do YouTube / arquivo-doc / URL externa). Uma tabela mantém
queries, rotas e testes uniformes e é pg-mem-safe (id texto, sem FK).

**Alternatives considered**:
- *3 tabelas (lessons/docs/codequest)*: rejeitada — triplica CRUD/rotas/testes sem ganho; o
  comportamento é idêntico.
- *`resource` como JSON polimórfico*: desnecessário — uma string de recurso + `kind` bastam nesta
  story (sem progresso/estrutura).

---

## D2 — Liberação drip: como avaliar `release_at`

**Decision**: coluna `release_at timestamptz` **nullable**. Item **liberado** quando
`release_at IS NULL` **ou** `now ≥ release_at`. Avaliado em TS (`isReleased(item, now)`), nunca em
coluna `GENERATED` (Constituição VI).

**Rationale**: drip por data sem agendador externo — a "liberação" é derivada do relógio na leitura,
igual à janela de ingresso da 8.12 (`ingressoPhase`). `null` ⇒ liberado evita travar conteúdo por
falta de agendamento (edge case da spec).

**Alternatives considered**:
- *Job/cron que "publica" itens*: rejeitada — estado derivável do tempo não precisa de escrita
  agendada; simplifica e fica testável com `now` injetado.
- *Coluna booleana `published`*: rejeitada — não expressa "quando"; drip precisa da data.

**Combinação com o gate**: um item é **acessível ao lead** sse `hasCompletedSurvey(lead)` **e**
`isReleased(item, now)`. As duas condições são independentes (gate global de pesquisa × data por item).

---

## D3 — Não vazar o `resource` de item bloqueado

**Decision**: o `GET /api/evento/conteudo` retorna **metadados** (title/description/kind/isGift/
releaseAt/available) mas **omite `resource`** de qualquer item não acessível (gate não satisfeito **ou**
não liberado). O `resource` só é revelado por **`POST /api/evento/conteudo/[id]/abrir`**, que revalida
gate+release no servidor.

**Rationale**: docs com presentes e a URL do CodeQuest não podem vazar antes da hora (segurança/
antecipação). Centralizar a revelação no "abrir" também dá o ponto natural de medição
(`content.opened`).

**Alternatives considered**:
- *Mandar `resource` sempre e esconder no front*: rejeitada — vazaria via devtools/rede.
- *Só ocultar por gate, expor por data*: rejeitada — item "em breve" também não pode entregar o
  recurso.

---

## D4 — Medição do acesso: novo tipo `content.opened`

**Decision**: adicionar **`content.opened`** à taxonomia FROZEN (`EngagementType` + CONTRIBUTING §3),
emitido no `abrir` com `data: { kind, itemId }`.

**Rationale**: Constituição IV exige medir cada acesso; um tipo único cobre os 3 kinds sem poluir
`lesson.started` (que pertence às aulas do evento 8.4 e carrega `durationSeconds`). Precedentes de
adição coordenada: `referral.signup` (8.3), `hub.viewed` (8.12).

**Alternatives considered**:
- *Reusar `lesson.started` para nivelamento*: rejeitada — mistura com o scoring de aulas do evento.
- *Um tipo por kind*: rejeitada — 3 tipos para o mesmo sinal; `{ kind }` no payload já distingue.

---

## D5 — CodeQuest como link externo (exceção à Constituição III)

**Decision**: o item `kind='codequest'` guarda uma **URL externa** em `resource`; o "abrir" mede
(`content.opened`) e devolve a URL, que o cliente abre em **nova aba** (`target="_blank"` +
`rel="noopener"`). Registrado no **Complexity Tracking** como exceção justificada à Constituição III.

**Rationale**: decisão de produto (`/speckit-clarify`) — CodeQuest é produto separado, não embedável
nesta story. Mitiga-se: acesso medido, escopo limitado ao link, sem SSO/progresso.

**Alternatives considered**:
- *Embed/iframe do CodeQuest*: rejeitada agora — depende de suporte a embed/SSO do CodeQuest; fica
  para integração futura.
- *Proxiar o CodeQuest sob o domínio*: rejeitada — reintroduz complexidade de runtime/segurança.

---

## D6 — Provisionamento de conteúdo (sem admin UI)

**Decision**: Route Handler admin **`POST /api/events/[eventId]/conteudo`** autenticado por
**`X-Api-Key`** (mesmo padrão da ingestão de leads/8.1) cria itens de conteúdo. Sem interface de
admin nesta story (como 8.4; admin UI é 8.9).

**Rationale**: a feature precisa de um caminho de criação testável; o padrão admin `X-Api-Key`
(Constituição VI) já existe no projeto. Mantém o escopo sem antecipar a 8.9.

**Alternatives considered**:
- *Seed via env/JSON*: rejeitada — não é por-evento nem cobre atualização; menos testável.
- *Esperar a admin UI (8.9)*: rejeitada — bloquearia 8.14 desnecessariamente.
