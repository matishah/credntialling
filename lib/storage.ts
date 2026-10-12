import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { decryptBuffer, encryptBuffer } from "./crypto";

// Document bytes, encrypted with APP_ENCRYPTION_KEY before they leave memory.
// Local dev writes to ./.data/files. For production swap these three functions for
// S3 (bucket with SSE-KMS, private, no public URLs) – callers only see opaque keys.

const root = () => process.env.FILES_DIR ?? path.join(process.cwd(), ".data", "files");
const fileFor = (key: string) => {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("Bad storage key");
  return path.join(root(), key);
};

export async function putFile(bytes: Buffer): Promise<string> {
  const key = randomUUID();
  await mkdir(root(), { recursive: true });
  await writeFile(fileFor(key), encryptBuffer(bytes));
  return key;
}

export async function getFile(key: string): Promise<Buffer> {
  return decryptBuffer(await readFile(fileFor(key)));
}

export async function deleteFile(key: string) {
  await rm(fileFor(key), { force: true });
}
