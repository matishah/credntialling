import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ForbiddenError } from "./auth";

export type ActionState = { ok?: string; error?: string } | null;

/** Turns thrown errors into a form-friendly `{ error }` while letting redirects through. */
export async function safe(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn();
    return { ok: ok || "Saved" };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ForbiddenError) return { error: err.message };
    if (err instanceof UserError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. Please try again." };
  }
}

export class UserError extends Error {}

export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

export function required(fd: FormData, key: string, label = key) {
  const v = str(fd, key);
  if (!v) throw new UserError(`${label} is required`);
  return v;
}
