/**
 * Prepara fotos no navegador antes do envio: reduz para no máximo 1800 px e
 * converte para WebP (ou JPEG). Uma foto de celular de 5–12 MB vira ~200–500 KB,
 * o envio fica rápido e nunca passa do limite do servidor.
 */
const MAX_SIDE = 1800;
const QUALITY = 0.86;

export class ImageReadError extends Error {}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Safari antigo / formatos que só o <img> decodifica (ex.: HEIC no iPhone).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new ImageReadError(
        `Não consegui abrir "${file.name}". Se for foto do iPhone (HEIC), envie pelo próprio iPhone ou salve como JPG.`,
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function compressImage(file: File): Promise<File> {
  const src = await decode(file);
  const w = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h = "naturalHeight" in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageReadError("Seu navegador não conseguiu processar a foto.");
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if ("close" in src) src.close();

  const toBlob = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, QUALITY));
  let blob = await toBlob("image/webp");
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob("image/jpeg");
    ext = "jpg";
  }
  if (!blob) throw new ImageReadError("Não consegui converter a foto.");
  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}

/** Nome do arquivo sem extensão, legível ("aurora_perfume-01.jpg" → "aurora perfume 01"). */
export function fileLabel(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
