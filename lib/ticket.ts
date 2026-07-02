// Montagem do ingresso visual (research D1/D2). O ingresso é uma **URL de
// transformação do Cloudinary** — nenhuma chamada bloqueante no servidor: a URL
// é uma string e o navegador renderiza. Quando o Cloudinary não está
// configurado (ex.: testes/dev sem env), degrada para a própria foto ou o
// avatar padrão, mantendo o comportamento determinístico e pg-mem-safe.

import type { Lead } from "./leads";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
const TEMPLATE = process.env.NEXT_PUBLIC_CLOUDINARY_TICKET_TEMPLATE || "";

/** Avatar padrão exibido quando o participante não envia foto (FR-003/FR-015). */
export const DEFAULT_AVATAR = "/sprites/happy-mage.png";

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
function fetchLayer(url: string): string {
  return Buffer.from(url, "utf8").toString("base64url");
}

// Overlay de texto do Cloudinary escapa `,` e `/` no valor.
function encodeText(text: string): string {
  return encodeURIComponent(text)
    .replace(/%2C/g, "%252C")
    .replace(/%2F/g, "%252F");
}

/**
 * URL de transformação do Cloudinary: template do evento + overlay da foto
 * (ou avatar padrão) + overlay do nome. Sem Cloudinary configurado, devolve a
 * própria foto ou o avatar — o preview ainda mostra algo coerente.
 */
export function buildTicketImageUrl(
  lead: Pick<Lead, "name" | "photoUrl">,
): string {
  const photo = lead.photoUrl || null;

  if (!CLOUD || !TEMPLATE) {
    return photo || DEFAULT_AVATAR;
  }

  const layers: string[] = [];

  if (photo) {
    // Foto circular sobre o template.
    layers.push(
      `l_fetch:${fetchLayer(photo)},w_360,h_360,c_fill,g_face,r_max`,
      `fl_layer_apply,g_north,y_200`,
    );
  }

  if (lead.name) {
    layers.push(
      `l_text:Mulish_54_bold:${encodeText(lead.name)},co_white`,
      `fl_layer_apply,g_south,y_170`,
    );
  }

  const transform = layers.length ? `${layers.join("/")}/` : "";
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${transform}${TEMPLATE}.png`;
}
