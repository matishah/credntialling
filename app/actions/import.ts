"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parseWorkbook, type ParseResult } from "@/lib/import/parse";
import { commitImport, type ImportSummary } from "@/lib/import/commit";

const MAX_BYTES = 8 * 1024 * 1024;

async function readUpload(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a spreadsheet first.");
  if (file.size > MAX_BYTES) throw new Error("File is larger than 8 MB.");
  if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) throw new Error("Upload an .xlsx, .xls or .csv file.");
  const buf = Buffer.from(await file.arrayBuffer());
  return { name: file.name, buf, hash: createHash("sha256").update(buf).digest("hex") };
}

/** Masks PHI before anything is sent back to the browser for preview. */
function mask(result: ParseResult): ParseResult {
  return {
    ...result,
    practices: result.practices.map((p) => ({
      ...p,
      providers: p.providers.map((pr) => ({
        ...pr,
        ssn: pr.ssn ? `•••-••-${pr.ssn.replace(/\D/g, "").slice(-4)}` : null,
        logins: pr.logins.map((l) => ({ ...l, password: l.password ? "••••••••" : null })),
      })),
    })),
  };
}

export type PreviewResponse =
  | { ok: true; fileName: string; preview: ParseResult; alreadyImported: string | null }
  | { ok: false; error: string };

export async function previewImport(fd: FormData): Promise<PreviewResponse> {
  try {
    await requirePermission("import.run");
    const { name, buf, hash } = await readUpload(fd);
    const parsed = parseWorkbook(buf);
    const [prior] = await db.select().from(schema.imports).where(eq(schema.imports.fileHash, hash)).limit(1);
    return {
      ok: true,
      fileName: name,
      preview: mask(parsed),
      alreadyImported: prior ? prior.createdAt.toISOString().slice(0, 10) : null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not read that file." };
  }
}

export type CommitResponse = { ok: true; summary: ImportSummary } | { ok: false; error: string };

// The browser re-sends the file instead of the preview, so unmasked PHI never round-trips through the client.
export async function runImport(fd: FormData): Promise<CommitResponse> {
  try {
    const user = await requirePermission("import.run");
    const { name, buf, hash } = await readUpload(fd);
    const [prior] = await db.select().from(schema.imports).where(eq(schema.imports.fileHash, hash)).limit(1);
    if (prior) return { ok: false, error: `This exact file was already imported on ${prior.createdAt.toISOString().slice(0, 10)}.` };
    const parsed = parseWorkbook(buf);
    if (!parsed.practices.length) return { ok: false, error: "Nothing to import in this file." };
    const summary = await commitImport(parsed, { fileName: name, fileHash: hash, userId: user.id });
    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (err) {
    console.error(err);
    return { ok: false, error: err instanceof Error ? err.message : "Import failed." };
  }
}
