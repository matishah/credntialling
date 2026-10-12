import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Field-level encryption for SSNs and portal passwords (AES-256-GCM).
// APP_ENCRYPTION_KEY must be 32 random bytes, base64-encoded:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// In production keep it in AWS Secrets Manager / SSM, never in the repo.

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes");
  return buf;
}

export function encrypt(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [version, iv, tag, ct] = payload.split(":");
  if (version !== "v1") throw new Error("Unknown ciphertext version");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** Same scheme for file bytes: [12-byte IV][16-byte tag][ciphertext]. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
}
