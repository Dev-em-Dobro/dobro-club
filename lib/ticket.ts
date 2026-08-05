// Montagem do ingresso visual (research D1/D2). O ingresso é uma **URL de
// transformação do Cloudinary** — nenhuma chamada bloqueante no servidor: a URL
// é uma string e o navegador renderiza. Quando o Cloudinary não está
// configurado (ex.: testes/dev sem env), degrada para o **template do evento**
// servido de `/public` (sem overlay de foto/nome), mantendo o comportamento
// determinístico e pg-mem-safe.
//
// Template ativo: "Ingresso Lançamento AGO 26 - GTA" (608×1080, story 9:16). O
// card preto no centro tem uma faixa livre (abaixo do título "SEMANA DO ZERO AO
// PROGRAMADOR CONTRATADO" e acima da perfuração/pílula "De 10 a 16 de agosto —
// Evento totalmente online e gratuito") — é a zona de personalização onde entram
// foto + nome. Enquanto o Cloudinary não estiver configurado, o fallback usa o
// próprio PNG local; quando NEXT_PUBLIC_CLOUDINARY_TICKET_TEMPLATE (public_id do
// PNG subido) estiver setado, a URL de transformação compõe foto + nome
// (coordenadas abaixo assumem 608×1080).

import type { Lead } from "./leads";
import { isTicketOnly, type EventRow } from "./events";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const TEMPLATE = process.env.NEXT_PUBLIC_CLOUDINARY_TICKET_TEMPLATE || "";
// public_id do avatar padrão no Cloudinary, usado quando o participante não
// envia foto (FR-003/FR-015). Já é circular/transparente — mesmo recorte da foto.
const AVATAR = process.env.NEXT_PUBLIC_CLOUDINARY_TICKET_AVATAR || "avatar-ingresso_suacwi";

// Geometria da zona de personalização no template 608×1080 (faixa livre do card
// preto, entre o título e a perfuração/pílula de data). Offsets a partir do
// topo, imagem centralizada em x. Calibrado visualmente sobre o template
// (faixa livre real ~y=620–880, card com ~470px de largura útil nessa altura).
// Avatar e nome ficam CENTRADOS no eixo do título (medido: "PROGRAMADOR"/
// "CONTRATADO" centram em x=304 = centro da imagem). Não deslocar em x: jogar a
// foto pro lado a tira do eixo do título e o conjunto lê como desalinhado.
const PHOTO_SIZE = 164; // diâmetro do recorte circular (prominência do template)
const PHOTO_TOP = 650; // topo da foto, logo abaixo do título
const NAME_TOP = 832; // topo do bloco de nome, acima da perfuração (~y=895)
// Não encolher: abaixo de ~300 o nome longo quebra em DUAS linhas e a segunda
// invade a perfuração — mais estreito piora, ao contrário do que parece.
const NAME_WIDTH = 300; // largura máxima do texto
// Inclinação leve do nome, casando com a diagonal de ~2° do próprio card — sutil
// de propósito: mais que isso lê como "torto", não como parte do design.
const NAME_ANGLE = -2;

// Encolhe a fonte p/ nomes longos caberem em UMA linha na largura do card. O
// gargalo não é a altura (a folga até a perfuração fica ~35–40px em todos os
// tamanhos), é a quebra de linha: com fonte grande, um nome longo passa de
// `w_${NAME_WIDTH}` e vira duas linhas — a segunda invade a perfuração. Tiers
// medidos: 30/24/18 mantêm até 14 / 22 / ~29 caracteres numa linha só.
function nameFontSize(name: string): number {
  const len = name.length;
  if (len <= 14) return 30;
  if (len <= 22) return 24;
  return 18;
}

/** Avatar padrão exibido quando o participante não envia foto (FR-003/FR-015). */
export const DEFAULT_AVATAR = "/sprites/happy-mage.png";

/**
 * Template do evento servido de `/public` (cópia de
 * `assets/Ingresso Lançamento AGO 26 - GTA.png`). Usado como ingresso no
 * fallback enquanto o Cloudinary não está configurado.
 */
export const DEFAULT_TEMPLATE = "/ingresso-template.png";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.DOBRO_BASE_URL ||
    "http://localhost:3000"
  );
}

export type TicketEvent = Pick<EventRow, "slug" | "mode">;

/**
 * Caminho público do gerador de ingresso. O evento completo vive em `/ingresso`
 * (slug fixado por env). O evento `ticket-only` não tem hub nem env próprio: o
 * link que circula é o do gerador daquele slug (`/e/<slug>/ingresso`).
 */
export function ingressoPath(event?: TicketEvent | null): string {
  return event && isTicketOnly(event)
    ? `/e/${encodeURIComponent(event.slug)}/ingresso`
    : "/ingresso";
}

/**
 * URL de convite pública embutida no QR e no botão compartilhar. Leva OUTRA
 * pessoa à tela de geração **do mesmo evento**, atribuindo a indicação ao dono
 * (`?ref=<leadId>`). **Nunca** contém o token de sessão do dono (SC-006).
 */
export function qrValue(
  lead: Pick<Lead, "id">,
  event?: TicketEvent | null,
): string {
  return `${baseUrl()}${ingressoPath(event)}?ref=${encodeURIComponent(lead.id)}`;
}

/** Alias semântico: o botão "compartilhar" usa a mesma URL pública do QR. */
export function shareUrl(
  lead: Pick<Lead, "id">,
  event?: TicketEvent | null,
): string {
  return qrValue(lead, event);
}

// Cloudinary embute o overlay de uma imagem remota via `l_fetch:<base64url>`.
// Só é usado como fallback: fotos da própria conta entram por public_id (abaixo).
function fetchLayer(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

// Extrai o public_id de uma URL de entrega do Cloudinary da MESMA conta
// (ex.: `.../image/upload/v123/abc.jpg` → `abc`). Como a foto do participante é
// upada no nosso próprio Cloudinary, referenciamos por public_id (`l_<id>`) em
// vez de `l_fetch` — evita a restrição de "fetch" da conta e é mais eficiente.
function cloudinaryPublicId(url: string): string | null {
  const prefix = `https://res.cloudinary.com/${CLOUD}/image/upload/`;
  if (!CLOUD || !url.startsWith(prefix)) return null;
  const path = url
    .slice(prefix.length)
    .replace(/^v\d+\//, "") // remove a versão
    .replace(/\.[a-z0-9]+$/i, ""); // remove a extensão
  return path || null;
}

// Overlay de texto do Cloudinary escapa `,` e `/` no valor.
function encodeText(text: string): string {
  return encodeURIComponent(text)
    .replace(/%2C/g, "%252C")
    .replace(/%2F/g, "%252F");
}

/**
 * URL de transformação do Cloudinary: template do evento + overlay da foto
 * (ou avatar padrão) + overlay do nome, posicionados na faixa de personalização
 * do card. Sem Cloudinary configurado, devolve o **template do evento** local —
 * o preview já mostra o ingresso correto (sem foto/nome até o cutover Cloudinary).
 */
export function buildTicketImageUrl(
  lead: Pick<Lead, "name" | "photoUrl">,
): string {
  const photo = lead.photoUrl || null;

  if (!CLOUD || !TEMPLATE) {
    return DEFAULT_TEMPLATE;
  }

  const layers: string[] = [];

  // Foto circular na faixa livre do card roxo — a do participante ou, se ele não
  // enviar, o avatar padrão. Asset da própria conta entra por public_id; URL
  // externa cai no fallback `l_fetch`.
  const pid = photo ? cloudinaryPublicId(photo) : null;
  const source = photo
    ? pid
      ? `l_${pid.replace(/\//g, ":")}`
      : `l_fetch:${fetchLayer(photo)}`
    : `l_${AVATAR}`;
  layers.push(
    `${source},w_${PHOTO_SIZE},h_${PHOTO_SIZE},c_fill,g_face,r_max`,
    `fl_layer_apply,g_north,y_${PHOTO_TOP}`,
  );

  if (lead.name) {
    layers.push(
      `l_text:Montserrat_${nameFontSize(lead.name)}_bold:${encodeText(lead.name)},co_white,c_fit,w_${NAME_WIDTH},a_${NAME_ANGLE}`,
      `fl_layer_apply,g_north,y_${NAME_TOP}`,
    );
  }

  const transform = layers.length ? `${layers.join("/")}/` : "";
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${transform}${TEMPLATE}.png`;
}

const CLOUDINARY_UPLOAD = "/image/upload/";

/**
 * Mesma imagem do ingresso, servida como **download** em vez de exibição. No
 * Cloudinary isso é a flag `fl_attachment` (responde com `Content-Disposition:
 * attachment`), que é o que faz o botão "baixar" salvar o arquivo mesmo sendo
 * outra origem — o atributo `download` do `<a>` é ignorado cross-origin. No
 * fallback local o template é da mesma origem, então a URL já basta.
 */
export function buildTicketDownloadUrl(
  lead: Pick<Lead, "name" | "photoUrl">,
): string {
  const url = buildTicketImageUrl(lead);
  const at = url.indexOf(CLOUDINARY_UPLOAD);
  if (!url.startsWith("https://res.cloudinary.com/") || at === -1) return url;
  const cut = at + CLOUDINARY_UPLOAD.length;
  return `${url.slice(0, cut)}fl_attachment:ingresso/${url.slice(cut)}`;
}
