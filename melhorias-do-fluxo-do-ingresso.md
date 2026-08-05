# Melhorias no fluxo do ingresso (chat do Mestre)

## Contexto

O chat do "Mestre do Evento" (`components/IngressoChat.tsx`) hoje coloca duas fricções logo na entrada: a pessoa precisa **digitar "INGRESSO"** e depois clicar no botão **"ESTOU PREPARADO 🚀"** antes de o fluxo começar de fato. Além disso, o efeito de "digitando…" tem tempo fixo (sensação robótica) e o emoji da mensagem de compartilhamento (🎟️ `U+1F39F`) não tem suporte em WhatsApp/Android antigos, aparecendo como `�`.

Objetivos:

1. Começar o fluxo direto — o Mestre saúda, fala do evento e já pede o nome.
2. Deixar a digitação mais natural (mais lenta, com ritmo variável).
3. Corrigir o emoji quebrado no compartilhamento.

Decisões: roteiro de abertura = **saudação + fala sobre o evento + pedido dos dados**; emoji de compartilhamento = **🎫** (`U+1F3AB`, suporte universal); digitação natural **nos dois chats** (ingresso + captura de lead).

---

## Mudança 1 — Início direto (remover "Digite INGRESSO" e o botão "ESTOU PREPARADO")

Fluxo atual: `greet` (digita INGRESSO) → `prepared` (botão ESTOU PREPARADO) → `askName`.
Fluxo novo: o Mestre fala a abertura e **emenda direto em `askName`**. Os passos `prepared`/`start` deixam de existir.

### `lib/copy/ingresso.ts`

- Reescrever `greet` para o roteiro de abertura (sem "Digite INGRESSO"), no formato saudação → fala do evento → pedido dos dados. Proposta (ajustável):

  ```ts
  greet: [
    `Opa! Seja bem-vindo(a) à ${eventName} 🎮`,
    "Que bom te ver por aqui — vai ser um evento e tanto! ✨",
    "Pra garantir sua presença, vou gerar seu ingresso individual e personalizado. Só preciso de alguns dados rapidinho 🎫",
  ],
  ```

- Remover `start` da interface `IngressoCopy` e do objeto retornado (fica órfão). O conteúdo "abertura" foi absorvido pelo `greet`.

### `components/IngressoChat.tsx`

- `useEffect` de saudação (`~:146-150`): trocar `void botSay(copy.greet)` por uma função `startConversation()` que faz `await botSay(copy.greet)` e em seguida `await goAskName()`.
- Remover `startFlow()` (`~:169-172`) e a referência a `copy.start`.
- Em `renderFooter()`: remover `case "greet"` do grupo de input de texto (`~:555-558`) e remover o bloco `case "prepared"` (`~:594-595`). Ajustar o ternário de `placeholder` (`~:574-582`) para não referenciar mais `greet`.
- Em `onTextSubmit()`: remover o bloco `if (step === "greet")` (`~:433-439`).
- No `type Step` (`~:31-44`): remover `"prepared"`. Manter `"greet"` como passo inicial (agora só a intro, sem footer).

> Durante a intro o `step` continua `greet` e `typing` fica `true`, então o footer some naturalmente (`renderFooter` já retorna `null` quando `typing`). Cutucada de inatividade e auto-scroll seguem sem alteração.

---

## Mudança 2 — Digitação mais natural (nos dois chats)

Hoje `botSay` usa `sleep(650)`/`sleep(600)` fixos + pausa fixa, independentes do tamanho do texto. Trocar por um atraso **proporcional ao tamanho da linha, com piso/teto e jitter aleatório**.

### Novo arquivo `lib/chat-typing.ts`

```ts
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Duração do "digitando…" proporcional ao tamanho da linha, com piso/teto e um
// jitter aleatório pra não soar robótico. Imagens (texto vazio) caem no piso.
export function typingDelay(text: string): number {
  const base = 450;
  const perChar = 32; // ms por caractere
  const jitter = Math.random() * 400;
  return Math.min(2600, base + text.length * perChar + jitter);
}
```

### `components/IngressoChat.tsx` (`botSay`, `~:122-135`)

- Importar `sleep`/`typingDelay` de `@/lib/chat-typing` e remover o `const sleep` local (`~:67`).
- No loop: extrair o texto da linha (`typeof line === "string" ? line : line.text ?? ""`), usar `await sleep(typingDelay(text))` no lugar de `sleep(650)` e `await sleep(260 + Math.random() * 240)` no lugar de `sleep(180)`.

### `components/MestreCaptura.tsx` (`botSay`, `~:64-76`)

- Mesma troca (linhas são só strings aqui): importar de `@/lib/chat-typing`, remover `sleep` local (`~:16`), usar `typingDelay(line)` e a pausa com jitter.

> Os números ficam centralizados em `lib/chat-typing.ts` para ajuste fino.

---

## Mudança 3 — Emoji quebrado no compartilhamento

Fonte única do texto de share: `shareText()` em `components/IngressoChat.tsx:346-348`, usada por WhatsApp (`shareOnWhatsApp`), Instagram (`shareOnInstagram`) e share nativo (`shareTicket`). Corrigir um ponto cobre todas as redes.

- `shareText()` (`~:347`): trocar `🎟️` por `🎫` → `` `Garanti meu ingresso pra ${event}! 🎫` ``.
- Consistência: trocar o `🎟️` restante em `lib/copy/ingresso.ts` no `finish` do `ticketOnly` (`~:62`) por `🎫`.
- O preview do link (OpenGraph em `app/e/[slug]/ingresso/page.tsx:33-56`) não tem emoji — nada a fazer; o `encodeURIComponent` do `wa.me/?text=` já está correto.

---

## Testes a ajustar

`tests/copy.ingresso.test.ts:20-23` — o caso "usa o nome do evento na saudação e na abertura" checa `classico.start` (`:22`), que deixa de existir. Atualizar para validar apenas `classico.greet` (que agora contém saudação + abertura), removendo a asserção sobre `.start`.

---

## Arquivos afetados (resumo)

- `lib/copy/ingresso.ts` — reescrever `greet`, remover `start`, `🎟️`→`🎫` no `finish` ticketOnly.
- `components/IngressoChat.tsx` — início direto (remover gate INGRESSO + botão), `botSay` natural, `shareText` com `🎫`.
- `components/MestreCaptura.tsx` — `botSay` natural.
- `lib/chat-typing.ts` (novo) — `sleep` + `typingDelay` compartilhados.
- `tests/copy.ingresso.test.ts` — remover asserção de `.start`.

---

## Verificação

1. **Testes/tipos**: `npm test` (vitest) e `npm run typecheck` — verde.
2. **Manual** (`npm run dev`, abrir `/ingresso`):
   - Ao carregar, o Mestre já saúda, fala do evento e cai direto no pedido do **nome** — sem campo "Digite INGRESSO" e sem botão "ESTOU PREPARADO".
   - A digitação parece mais lenta e com ritmo variável (falas longas demoram mais que as curtas).
   - Completar o fluxo e clicar em **"CHAMAR A GALERA NO WHATSAPP"**: a prévia mostra `Garanti meu ingresso pra … 🎫` (sem `�`) + o link `?ref=`.
   - Conferir também `/evento/mestre` (MestreCaptura): digitação mais natural e captura funcionando.

---

## Fora de escopo (nota)

Ao compartilhar a **imagem** do ingresso (Instagram / share nativo com arquivo), o link `?ref=<leadId>` não vai junto (`navigator.share({ text, files })` sem `url`), enfraquecendo a atribuição de indicação. Não faz parte destes 3 pedidos; fica registrado como melhoria futura.
