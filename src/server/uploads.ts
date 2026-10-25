import "server-only";

import { access, mkdir, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { DATA_DIR } from "./db";

export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Bare filename: a sha256 hex digest plus the sniffed extension — never anything a client chose. */
const UPLOAD_FILENAME_PATTERN = "[a-f0-9]{64}\\.(?:png|jpe?g|gif|webp)";
export const UPLOAD_FILENAME = new RegExp(`^${UPLOAD_FILENAME_PATTERN}$`);
/** The path such a file is served from, for validating a stored `image` value against it. */
export const UPLOAD_PATH_PATTERN = new RegExp(`^/uploads/${UPLOAD_FILENAME_PATTERN}$`);

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

/**
 * Saves `buffer` under its content hash and returns the path to serve it from. Identical uploads
 * (the same photo added twice, or reused across items) collapse onto the same file, and because the
 * name is the content's own hash, the URL is safe to cache forever — it can never point at different
 * bytes later. Throws if the buffer is not one of the accepted image formats.
 */
export async function saveUpload(buffer: Buffer): Promise<{ path: string; contentType: string }> {
  const signature = sniffImage(buffer);
  if (!signature) throw new Error("UNSUPPORTED_IMAGE_TYPE");

  const hash = createHash("sha256").update(buffer).digest("hex");
  const filename = `${hash}.${signature.ext}`;
  const dest = path.join(UPLOAD_DIR, filename);

  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    await access(dest);
  } catch {
    const temp = `${dest}.${process.pid}.tmp`;
    await writeFile(temp, buffer, { mode: 0o644 });
    await rename(temp, dest);
  }

  return { path: `/uploads/${filename}`, contentType: signature.contentType };
}
