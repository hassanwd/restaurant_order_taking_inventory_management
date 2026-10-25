"use server";

import { mutate, recordAudit } from "../db";
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
    const saved = await saveUpload(buffer).catch(() => null);
    if (!saved) throw new ActionError("That file is not a PNG, JPEG, WEBP or GIF image.");

    await mutate((db) =>
      recordAudit(db, user, "image.upload", `${purpose} · ${saved.path} · ${Math.ceil(buffer.length / 1024)}KB`),
    );
    return { ok: true, path: saved.path };
  });
}
