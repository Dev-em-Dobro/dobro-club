// Montagem do ingresso visual (research D1/D2). O ingresso é uma **URL de
// transformação do Cloudinary** — nenhuma chamada bloqueante no servidor: a URL
// é uma string e o navegador renderiza. Quando o Cloudinary não está
// configurado (ex.: testes/dev sem env), degrada para o **template do evento**
// servido de `/public` (sem overlay de foto/nome), mantendo o comportamento
// determinístico e pg-mem-safe.
//
// Template ativo: "Ingresso Lançamento MAR_ABR 26" (608×1080, story 9:16). O
// card roxo no centro tem uma faixa livre (abaixo do título "SEMANA <DO ZERO AO
// PROGRAMADOR CONTRATADO>" e acima da pílula "Evento totalmente online e
// gratuito") — é a zona de personalização onde entram foto + nome. Enquanto o
// Cloudinary não estiver configurado, o fallback usa o próprio PNG local; quando
// NEXT_PUBLIC_CLOUDINARY_TICKET_TEMPLATE (public_id do PNG subido) estiver setado,
// a URL de transformação compõe foto + nome (coordenadas abaixo assumem 608×1080).

import type { Lead } from "./leads";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const TEMPLATE = process.env.NEXT_PUBLIC_CLOUDINARY_TICKET_TEMPLATE || "";
// public_id do avatar padrão no Cloudinary, usado quando o participante não
// envia foto (FR-003/FR-015). Já é circular/transparente — mesmo recorte da foto.
const AVATAR = process.env.NEXT_PUBLIC_CLOUDINARY_TICKET_AVATAR || "avatar-ingresso_suacwi";

// Geometria da zona de personalização no template 608×1080 (faixa livre do card,
// entre o título e a pílula "Evento totalmente online e gratuito"). Offsets a
// partir do topo, imagem centralizada em x. Calibrado visualmente sobre o template.
const PHOTO_SIZE = 118; // diâmetro do recorte circular da foto
const PHOTO_TOP = 372; // topo da foto dentro do card roxo
const NAME_TOP = 508; // topo do bloco de nome, acima da pílula
const NAME_WIDTH = 250; // largura máxima do texto (quebra dentro do card)

// A faixa é estreita; encolhe a fonte p/ nomes longos não baterem na pílula.
function nameFontSize(name: string): number {
  const len = name.length;
  if (len <= 13) return 28;
  if (len <= 22) return 22;
  return 18;
}

/** Avatar padrão exibido quando o participante não envia foto (FR-003/FR-015). */
export const DEFAULT_AVATAR = "/sprites/happy-mage.png";

/**
 * Template do evento servido de `/public` (cópia de
 * `assets/Ingresso Lançamento MAR_ABR 26.png`). Usado como ingresso no fallback
 * enquanto o Cloudinary não está configurado.
 */
export const DEFAULT_TEMPLATE = "/ingresso-template.png";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.DOBRO_BASE_URL ||
    "http://localhost:3000"
  );
}

/**
 * URL de convite pública embutida no QR e no botão compartilhar. Leva OUTRA
 * pessoa à tela de geração, atribuindo a indicação ao dono (`?ref=<leadId>`).
 * **Nunca** contém o token de sessão do dono (SC-006).
 */
export function qrValue(lead: Pick<Lead, "id">): string {
  return `${baseUrl()}/ingresso?ref=${encodeURIComponent(lead.id)}`;
}

/** Alias semântico: o botão "compartilhar" usa a mesma URL pública do QR. */
export function shareUrl(lead: Pick<Lead, "id">): string {
  return qrValue(lead);
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
      `l_text:Montserrat_${nameFontSize(lead.name)}_bold:${encodeText(lead.name)},co_white,c_fit,w_${NAME_WIDTH}`,
      `fl_layer_apply,g_north,y_${NAME_TOP}`,
    );
  }

  const transform = layers.length ? `${layers.join("/")}/` : "";
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${transform}${TEMPLATE}.png`;
}
