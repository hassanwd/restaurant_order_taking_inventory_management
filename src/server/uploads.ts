import "server-only";

import { put } from "@vercel/blob";
import { createHash } from "node:crypto";

/**
 * Content-addressed photo storage, backed by Vercel Blob (public access) rather than local disk.
 * A serverless deployment's filesystem is read-only outside a temp folder, so this app cannot save
 * uploads next to itself the way a single-server deployment could — Blob gives every instance the
 * same durable, publicly-servable storage regardless of which one handled the upload.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const HASH_AND_EXT = "[a-f0-9]{64}\\.(?:png|jpe?g|gif|webp)";
/** Every public Vercel Blob URL ends in this domain — never user-choosable, so matching it plus
 * our own content-hash naming is enough to prove a stored `image` value came from `saveUpload`,
 * not from a client pasting an arbitrary (or `javascript:`) URL into a form. */
export const UPLOAD_URL_PATTERN = new RegExp(
  `^https://[a-z0-9]+\\.public\\.blob\\.vercel-storage\\.com/uploads/${HASH_AND_EXT}$`,
);

export const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Magic-byte signatures for the raster formats this app accepts. A browser's declared `file.type`
 * is just a label the client chose — this sniffs the actual bytes, so a renamed `.png` cannot smuggle
 * something else onto disk.
 */
const SIGNATURES: { ext: string; contentType: string; test: (buf: Buffer) => boolean }[] = [
  {
    ext: "png",
    contentType: "image/png",
    test: (buf) => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: "jpg",
    contentType: "image/jpeg",
    test: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    ext: "gif",
    contentType: "image/gif",
    test: (buf) => buf.length >= 6 && ["GIF87a", "GIF89a"].includes(buf.subarray(0, 6).toString("ascii")),
  },
  {
    ext: "webp",
    contentType: "image/webp",
    test: (buf) => buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export function sniffImage(buffer: Buffer) {
  return SIGNATURES.find((signature) => signature.test(buffer)) ?? null;
}

/** Thrown by `saveUpload` specifically when the bytes don't match a supported image format. */
export class UnsupportedImageError extends Error {
  constructor() {
    super("UNSUPPORTED_IMAGE_TYPE");
  }
}

/**
 * Uploads `buffer` to Blob storage under its own content hash and returns the public URL to serve
 * it from. Identical uploads (the same photo added twice, or reused across items) collapse onto the
 * same blob, and because the name is the content's own hash, the URL is safe to cache forever — it
 * can never point at different bytes later.
 */
export async function saveUpload(buffer: Buffer): Promise<{ path: string; contentType: string }> {
  const signature = sniffImage(buffer);
  if (!signature) throw new UnsupportedImageError();

  const hash = createHash("sha256").update(buffer).digest("hex");
  const filename = `${hash}.${signature.ext}`;

  const blob = await put(`uploads/${filename}`, buffer, {
    access: "public",
    contentType: signature.contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return { path: blob.url, contentType: signature.contentType };
}
