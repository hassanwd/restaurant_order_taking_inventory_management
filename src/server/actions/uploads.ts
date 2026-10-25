"use server";

import { recordAudit } from "../db";
import { prisma } from "../prisma";
import { MAX_UPLOAD_BYTES, saveUpload } from "../uploads";
import { ActionError, authorize, run, type ActionResult } from "./helpers";

export type UploadPurpose = "item" | "deal";

/**
 * Stores a menu item or deal photo the admin just picked. Takes `FormData` (a plain object could
 * not carry the `File`) with one `file` entry. The browser's claimed type and name are never
 * trusted — `saveUpload` sniffs the actual bytes and names the file from their hash.
 */
export async function uploadImageAction(
  purpose: UploadPurpose,
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  return run(async () => {
    const user = await authorize(purpose === "deal" ? "deals.manage" : "menu.manage");

    const file = formData.get("file");
    if (!(file instanceof File)) throw new ActionError("No file was received.");
    if (file.size === 0) throw new ActionError("That file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ActionError(`Image must be ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB or smaller.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let saved: Awaited<ReturnType<typeof saveUpload>> | null = null;
    let saveError: unknown = null;
    try {
      saved = await saveUpload(buffer);
    } catch (error) {
      saveError = error;
    }
    if (!saved) {
      // TEMPORARY diagnostic — remove once the Vercel-only upload failure is root-caused.
      const message = saveError instanceof Error ? `${saveError.name}: ${saveError.message}` : String(saveError);
      throw new ActionError(`DEBUG saveUpload threw: ${message}`);
    }

    await prisma.$transaction((tx) =>
      recordAudit(tx, user, "image.upload", `${purpose} · ${saved.path} · ${Math.ceil(buffer.length / 1024)}KB`),
    );
    return { ok: true, path: saved.path };
  });
}
