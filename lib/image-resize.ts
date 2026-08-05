// Redução de imagem no próprio navegador, para a foto do participante caber no
// limite de upload (FR-015) em vez de ser descartada. A foto entra no ingresso
// num recorte circular de 140px, então reduzir o lado maior para 1080px não tem
// custo visual perceptível — só evita subir os 8–12MB que uma câmera de celular
// produz. Reencoda em JPEG porque é o formato com melhor taxa de compressão
// entre os aceitos (o PNG de uma foto costuma ficar maior que o original).

const QUALITIES = [0.85, 0.7, 0.55];

/** Decodifica o arquivo. `createImageBitmap` é o caminho rápido; `<img>` é o fallback. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // formato que o decoder rápido não aceita — segue no <img>
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Devolve uma versão da imagem dentro de `maxBytes`, ou `null` quando nem na
 * menor qualidade ela cabe (ou o navegador não conseguiu decodificar o arquivo).
 * Quem chama decide o que fazer com o `null` — aqui não há fala com o usuário.
 */
export async function shrinkImage(
  file: File,
  maxBytes: number,
  maxSide = 1080,
): Promise<File | null> {
  const source = await decode(file);
  if (!source || !source.width || !source.height) return null;

  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close(); // libera o bitmap; o <img> o GC recolhe

  for (const quality of QUALITIES) {
    const blob = await encode(canvas, quality);
    if (blob && blob.size <= maxBytes) {
      const base = file.name.replace(/\.[^.]+$/, "") || "foto";
      return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    }
  }
  return null;
}
