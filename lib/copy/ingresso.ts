/**
 * Copy do Mestre do Evento (chat do ingresso) — texto separado do componente
 * para o roteiro poder ser revisado/ajustado sem tocar na máquina de estados.
 *
 * O roteiro base é o do **lançamento clássico** (Semana gratuita: aula ao vivo +
 * grupo de WhatsApp). O evento `ticket-only` (pago) reusa o mesmo funil, mas o
 * fecho é outro: não existe aula pra esperar nem grupo — a entrega é o ingresso.
 */

export interface CopyOptions {
  /** Nome do evento, como o participante o conhece. */
  eventName: string;
  /** Evento pago (só gerador de ingresso): sem aula/grupo no fecho. */
  ticketOnly?: boolean;
}

export interface IngressoCopy {
  greet: string[];
  start: string[];
  askName: string[];
  nameIncomplete: string[];
  confirmName: (name: string) => string[];
  askPhoto: string[];
  uploadPhoto: string[];
  photoRejected: string[];
  photoTooBig: string[];
  photoFailed: string[];
  askEmail: string[];
  invalidEmail: string[];
  confirmEmail: (email: string) => string[];
  askPhone: string[];
  invalidPhone: string[];
  confirmPhone: (phone: string) => string[];
  generating: string[];
  /** Ingresso novo: confirma com a pessoa se saiu correto. */
  askTicketOk: string;
  /** Lead que já tinha ingresso (`isNew: false`): vaga garantida, sem reconfirmar. */
  alreadyHasTicket: string[];
  /** O participante disse que o ingresso saiu errado: o sistema verifica e reemite. */
  ticketProblem: string[];
  /** A imagem não carregou por causa da foto: reemitido com o avatar padrão. */
  reissuedWithoutPhoto: string[];
  finish: string[];
  /** Cutucada quando a pessoa para no meio do fluxo. */
  idleNudge: string[];
  genericError: string;
  retryAfterError: string;
}

const PHONE_FORMAT =
  "Formato: 55 + DDD + número. Ex.: 5511999999999";

export function ingressoCopy({
  eventName,
  ticketOnly = false,
}: CopyOptions): IngressoCopy {
  // Fecho do lançamento clássico: a próxima aula e o grupo de WhatsApp. No evento
  // pago não há aula a anunciar — o fecho é o próprio ingresso.
  const finish = ticketOnly
    ? [
        "Maravilha! Seu ingresso está pronto ✨",
        "Compartilhe pra todo mundo saber que você vai estar lá 🎟️",
      ]
    : [
        "Maravilha! Te esperamos na primeira aula do evento, na próxima segunda-feira, 20h (horário de Brasília).",
        "No dia, você receberá o link da aula com antecedência, no grupo de whatsapp.",
      ];

  const alreadyHasTicket = ticketOnly
    ? [
        "Vi que você já garantiu o seu ingresso para o evento. Não se preocupe, sua vaga já está garantida!",
        "Aqui está ele de novo — é só baixar ou compartilhar 👇",
      ]
    : [
        "Vi que você já garantiu o seu ingresso para o evento. Não se preocupe, sua vaga já está garantida!",
        `Te esperamos na primeira aula do evento do Zero ao Programador Contratado, na próxima segunda-feira, 20h (horário de Brasília).`,
      ];

  return {
    greet: [
      `Opa! Seja bem-vindo(a) à ${eventName} 🎮`,
      "Digite INGRESSO para começar 🎟️",
    ],
    start: [
      `Chegou a hora de receber seu Ingresso individual e personalizado pra participar da ${eventName}!`,
      "Preparado(a)? 🚀",
    ],
    askName: [
      "Agora, digite o seu NOME e um SOBRENOME pra colocarmos no seu ingresso.",
      "Exemplo: Fulano de Tal",
    ],
    nameIncomplete: ["Preciso do NOME e do SOBRENOME 🙂 Ex.: Fulano de Tal"],
    confirmName: (name) => [
      name.toUpperCase(),
      "Confirma pra mim se seu nome está correto 👇🏼",
    ],
    askPhoto: [
      "Preciso de uma foto sua para gerar seu ingresso pessoal.",
      "Você prefere enviar uma foto sua ou manter o avatar padrão?",
    ],
    uploadPhoto: [
      "Boa! Me envie uma foto quadrada (formato 1:1), com o seu rosto bem centralizado.",
    ],
    photoRejected: [
      "Esse formato não rola (use JPEG, PNG ou WebP). Vou seguir com o avatar padrão 👍",
    ],
    photoTooBig: ["Essa imagem passou de 5MB. Vou seguir com o avatar padrão 👍"],
    photoFailed: [
      "Não consegui enviar sua foto agora — seguimos com o avatar padrão 👍",
    ],
    askEmail: [
      "Maravilha, seu ingresso já está sendo emitido…",
      "Enquanto isso, me fala qual o seu melhor e-mail 👇",
    ],
    invalidEmail: ["Hmm, esse e-mail não parece válido. Pode digitar de novo? 👇"],
    confirmEmail: (email) => ["É este e-mail mesmo?", `👉🏼 ${email}`],
    askPhone: [
      "Por último, me passa seu WhatsApp com DDI + DDD 📱",
      ticketOnly
        ? `É por ele que a gente te avisa das novidades do evento. ${PHONE_FORMAT}`
        : `É por ele que você recebe o link da aula e recupera seu acesso. ${PHONE_FORMAT}`,
    ],
    invalidPhone: [
      `Hmm, esse número não parece certo. Use DDI + DDD + número (só números). ${PHONE_FORMAT} 👇`,
    ],
    confirmPhone: (phone) => ["É esse número mesmo?", `👉🏼 ${phone}`],
    generating: [
      "⚠️ Aguarde enquanto estamos produzindo o seu ingresso…",
      "(Pode demorar um pouquinho, pois temos muitas requisições sendo feitas ao mesmo tempo.)",
    ],
    askTicketOk: "Seu ingresso foi emitido corretamente?",
    alreadyHasTicket,
    ticketProblem: ["Estamos verificando, vamos emitir seu ingresso novamente…"],
    reissuedWithoutPhoto: [
      "Sua foto não carregou aqui — reemiti o ingresso com o avatar padrão 👍",
    ],
    finish,
    idleNudge: [
      "Opa, vi que você ainda não finalizou o seu ingresso…",
      "É super rápido, falta só um pouco!",
      "Vamos continuar?",
    ],
    genericError: "Ops, algo deu errado ao gerar seu ingresso.",
    retryAfterError: "Vamos tentar de novo? Confirme seu e-mail 👇",
  };
}
