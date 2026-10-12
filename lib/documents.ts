import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { assertProviderAccess, canSeePractice, ForbiddenError, type CurrentUser } from "./auth";
import { UserError } from "./action";
import { MAX_DOCUMENT_MB as MAX_FILE_MB, PRACTICE_DOCUMENTS, PROVIDER_DOCUMENTS } from "./labels";
import { deleteFile, putFile } from "./storage";

// Content type comes from the extension we allow, never from the browser.
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  tif: "image/tiff",
  tiff: "image/tiff",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
};

export type PendingDoc = { category: string; file: File; mimeType: string; expiresOn: string | null };

/**
 * Reads the parallel `doc_category` / `doc_file` / `doc_expires` inputs, skipping rows with no file chosen.
 * Throws a UserError for anything we won't store, before a single byte is written.
 */
export function readDocRows(fd: FormData, owner: "provider" | "practice"): PendingDoc[] {
  const catalog = owner === "provider" ? PROVIDER_DOCUMENTS : PRACTICE_DOCUMENTS;
  const categories = fd.getAll("doc_category");
  const files = fd.getAll("doc_file");
  const expires = fd.getAll("doc_expires");
  const out: PendingDoc[] = [];
  files.forEach((file, i) => {
    if (!(file instanceof File) || file.size === 0) return;
    const category = String(categories[i] ?? "other");
    if (!(category in catalog)) throw new UserError(`Unknown document type for ${file.name}`);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!TYPES[ext]) throw new UserError(`${file.name}: upload a PDF, image, Word, Excel or text file.`);
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new UserError(`${file.name} is larger than ${MAX_FILE_MB} MB.`);
    const exp = expires[i];
    out.push({ category, file, mimeType: TYPES[ext], expiresOn: typeof exp === "string" && exp ? exp : null });
  });
  return out;
}

export async function saveDocuments(docs: PendingDoc[], owner: { providerId?: string; practiceId?: string }, userId: string) {
  for (const d of docs) {
    const bytes = Buffer.from(await d.file.arrayBuffer());
    const storageKey = await putFile(bytes);
    try {
      await db.insert(schema.documents).values({
        ...owner,
        category: d.category,
        fileName: d.file.name.slice(0, 200),
        mimeType: d.mimeType,
        size: bytes.length,
        storageKey,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        expiresOn: d.expiresOn,
        uploadedById: userId,
      });
    } catch (err) {
      await deleteFile(storageKey);
      throw err;
    }
  }
}

/** Loads a document the user is allowed to reach through its provider or practice. */
export async function loadDocument(user: CurrentUser, id: string) {
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
  if (!doc) throw new ForbiddenError("Document not found.");
  if (doc.providerId) await assertProviderAccess(user.practiceIds, doc.providerId);
  if (doc.practiceId && !canSeePractice(user, doc.practiceId)) throw new ForbiddenError("Document not found.");
  return doc;
}
