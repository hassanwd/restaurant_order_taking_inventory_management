const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downscales and re-encodes a picked photo in the browser before it is uploaded, so a multi-megabyte
 * phone photo does not turn into a multi-megabyte menu thumbnail. GIFs are left untouched — redrawing
 * one to a canvas would flatten it to its first frame and silently drop the animation. PNGs and WEBPs
 * are re-encoded in their own format rather than JPEG, which has no alpha channel: flattening a
 * transparent photo onto JPEG fills the transparent areas solid black (a canvas's default fill) before
 * the format is even written. If anything here fails (an unusual format, an older browser), the
 * original file is uploaded as-is; the server re-validates it regardless, so a skipped compression is
 * never a correctness problem, only a size one.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  const keepsAlpha = file.type === "image/png" || file.type === "image/webp";
  const outputType = keepsAlpha ? file.type : "image/jpeg";
  const outputExt = keepsAlpha ? (file.type === "image/png" ? ".png" : ".webp") : ".jpg";

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, outputExt), { type: outputType });
  } catch {
    return file;
  }
}
