import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";
import type { Permission } from "./permissions";

export const SESSION_COOKIE = "cred_session";
const SESSION_HOURS = 12;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  permissions: Set<Permission>;
  /** null = may see every practice */
  practiceIds: string[] | null;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Resolves the signed-in user once per request, or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      active: schema.users.active,
      roleName: schema.roles.name,
      permissions: schema.roles.permissions,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || !row.active) return null;

  const permissions = new Set(row.permissions as Permission[]);
  let practiceIds: string[] | null = null;
  if (!permissions.has("practices.view_all")) {
    const rows = await db
      .select({ practiceId: schema.userPractices.practiceId })
      .from(schema.userPractices)
      .where(eq(schema.userPractices.userId, row.id));
    practiceIds = rows.map((r) => r.practiceId);
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleName: row.roleName,
    permissions,
    practiceIds,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: CurrentUser, permission: Permission) {
  return user.permissions.has(permission);
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

/** For server actions: re-checks the session and the permission on every call. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, permission)) throw new ForbiddenError();
  return user;
}

export function canSeePractice(user: CurrentUser, practiceId: string) {
  return user.practiceIds === null || user.practiceIds.includes(practiceId);
}

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  detail?: unknown,
) {
  await db.insert(schema.auditLog).values({
    userId,
    action,
    entity,
    entityId: entityId ?? null,
    detail: (detail ?? null) as never,
  });
}

/** Providers belong to practices; a user may touch a provider if they can see any of its practices. */
export async function assertProviderAccess(userPracticeIds: string[] | null, providerId: string) {
  if (userPracticeIds === null) return;
  const links = await db
    .select({ practiceId: schema.practiceProviders.practiceId })
    .from(schema.practiceProviders)
    .where(eq(schema.practiceProviders.providerId, providerId));
  if (!links.some((l) => userPracticeIds.includes(l.practiceId))) throw new ForbiddenError();
}
