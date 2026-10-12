"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { audit, createSession, destroySession, getCurrentUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function login(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = user && user.active && (await verifyPassword(password, user.passwordHash));
  if (!ok) {
    await audit(user?.id ?? null, "login_failed", "user", user?.id, { email });
    return { error: "Incorrect email or password." };
  }

  await createSession(user.id);
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit(user.id, "login", "user", user.id);
  redirect("/");
}

export async function logout() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "logout", "user", user.id);
  redirect("/login");
}
