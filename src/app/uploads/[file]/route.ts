import { readFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_TYPE_BY_EXT, UPLOAD_DIR, UPLOAD_FILENAME } from "@/server/uploads";
import { getCurrentUser } from "@/server/session";

export const dynamic = "force-dynamic";

/**
 * Serves an uploaded menu/deal photo. Re-checks the session here too, the same way every other
 * route and action does — nothing in this app is reachable without one. The filename is the file's
 * own content hash, so the response can be cached forever without ever going stale.
 */
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[file]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { file } = await ctx.params;
  if (!UPLOAD_FILENAME.test(file)) return new Response("Not found", { status: 404 });

  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  try {
    const data = await readFile(path.join(UPLOAD_DIR, file));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
