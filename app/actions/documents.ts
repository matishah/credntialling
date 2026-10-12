"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertProviderAccess, audit, canSeePractice, ForbiddenError, requirePermission } from "@/lib/auth";
import { safe, str, UserError, type ActionState } from "@/lib/action";
import { loadDocument, readDocRows, saveDocuments } from "@/lib/documents";
import { deleteFile } from "@/lib/storage";

export async function uploadDocuments(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const user = await requirePermission("documents.manage");
    const providerId = str(fd, "providerId");
    const practiceId = str(fd, "practiceId");
    if (providerId) await assertProviderAccess(user.practiceIds, providerId);
    else if (!practiceId || !canSeePractice(user, practiceId)) throw new ForbiddenError();

    const docs = readDocRows(fd, providerId ? "provider" : "practice");
    if (!docs.length) throw new UserError("Choose a file to upload.");
    await saveDocuments(docs, providerId ? { providerId } : { practiceId: practiceId! }, user.id);
    await audit(user.id, "upload_document", providerId ? "provider" : "practice", providerId ?? practiceId, {
      files: docs.map((d) => ({ category: d.category, name: d.file.name })),
    });
    revalidatePath("/", "layout");
    return docs.length === 1 ? "Uploaded" : `Uploaded ${docs.length} files`;
  });
}

export async function deleteDocument(id: string) {
  const user = await requirePermission("documents.manage");
  const doc = await loadDocument(user, id);
  await db.delete(schema.documents).where(eq(schema.documents.id, id));
  await deleteFile(doc.storageKey);
  await audit(user.id, "delete_document", "document", id, { category: doc.category, name: doc.fileName });
  revalidatePath("/", "layout");
}
