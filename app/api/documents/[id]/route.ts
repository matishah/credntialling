import type { NextRequest } from "next/server";
import { audit, can, ForbiddenError, getCurrentUser } from "@/lib/auth";
import { loadDocument } from "@/lib/documents";
import { getFile } from "@/lib/storage";

// Documents hold PHI (licenses, photo IDs), so viewing needs sensitive.view and every open is audited.
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  if (!can(user, "sensitive.view")) return new Response("You don't have permission to open documents.", { status: 403 });

  const { id } = await ctx.params;
  let doc;
  try {
    doc = await loadDocument(user, id);
  } catch (err) {
    if (err instanceof ForbiddenError) return new Response("Document not found.", { status: 404 });
    throw err;
  }

  const bytes = await getFile(doc.storageKey);
  await audit(user.id, "view_document", "document", doc.id, { category: doc.category, name: doc.fileName });

  const disposition = INLINE.has(doc.mimeType) ? "inline" : "attachment";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
