import { readFile } from "node:fs/promises";
import path from "node:path";
import { CONTENT_TYPE_BY_EXT, LOCAL_UPLOAD_DIR, LOCAL_UPLOAD_NAME } from "@/server/uploads";

/**
 * Serves photos saved to local disk (development, when no Blob token is set). The name must be one
 * of our own content-hash filenames, so no other path can be reached through this route. The proxy
 * already requires a signed-in session for it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!LOCAL_UPLOAD_NAME.test(name)) return new Response("Not found", { status: 404 });

  try {
    const file = await readFile(path.join(LOCAL_UPLOAD_DIR, name));
    const ext = name.split(".").pop() ?? "";
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
