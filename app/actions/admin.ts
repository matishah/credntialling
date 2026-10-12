"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { audit, requirePermission } from "@/lib/auth";
import { required, safe, str, UserError, type ActionState } from "@/lib/action";
import { hashPassword } from "@/lib/password";
import { ALL_PERMISSIONS, type Permission } from "@/lib/permissions";

const { users, roles, userPractices, sessions } = schema;

function checkPassword(pw: string) {
  if (pw.length < 10) throw new UserError("Password must be at least 10 characters.");
}

export async function saveUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const admin = await requirePermission("users.manage");
    const id = str(fd, "id");
    const email = required(fd, "email", "Email").toLowerCase();
    const data = {
      name: required(fd, "name", "Name"),
      email,
      roleId: required(fd, "roleId", "Role"),
      active: fd.get("active") === "on",
    };
    const password = str(fd, "password");
    if (password) checkPassword(password);

    if (id) {
      if (id === admin.id && !data.active) throw new UserError("You can't deactivate yourself.");
      await db
        .update(users)
        .set({ ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) })
        .where(eq(users.id, id));
      if (!data.active || password) await db.delete(sessions).where(eq(sessions.userId, id)); // force re-login
      await audit(admin.id, "update", "user", id, { passwordReset: !!password });
    } else {
      if (!password) throw new UserError("Set an initial password.");
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
      if (exists) throw new UserError("A user with that email already exists.");
      const [row] = await db
        .insert(users)
        .values({ ...data, active: true, passwordHash: await hashPassword(password) })
        .returning({ id: users.id });
      await audit(admin.id, "create", "user", row.id);
    }
    revalidatePath("/admin", "layout");
    return id ? "User updated" : "User created";
  });
}

export async function setUserPractices(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const admin = await requirePermission("users.manage");
    const userId = required(fd, "userId");
    const ids = fd.getAll("practiceIds").map(String).filter(Boolean);
    await db.transaction(async (tx) => {
      await tx.delete(userPractices).where(eq(userPractices.userId, userId));
      if (ids.length) await tx.insert(userPractices).values(ids.map((practiceId) => ({ userId, practiceId })));
    });
    await audit(admin.id, "assign_practices", "user", userId, { count: ids.length });
    revalidatePath("/admin", "layout");
    return `${ids.length} practice${ids.length === 1 ? "" : "s"} assigned`;
  });
}

export async function saveRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safe(async () => {
    const admin = await requirePermission("users.manage");
    const id = str(fd, "id");
    const permissions = fd
      .getAll("permissions")
      .map(String)
      .filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p));
    const data = { name: required(fd, "name", "Role name"), description: str(fd, "description"), permissions };
    if (id) {
      const [role] = await db.select().from(roles).where(eq(roles.id, id));
      if (role?.isSystem) throw new UserError("The Admin role always has every permission.");
      await db.update(roles).set(data).where(eq(roles.id, id));
    } else {
      await db.insert(roles).values(data);
    }
    await audit(admin.id, id ? "update" : "create", "role", id, data);
    revalidatePath("/admin", "layout");
    return id ? "Role updated" : "Role created";
  });
}

export async function deleteRole(roleId: string) {
  const admin = await requirePermission("users.manage");
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId));
  if (!role || role.isSystem) return;
  const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.roleId, roleId));
  if (n > 0) throw new UserError("Move users off this role first.");
  await db.delete(roles).where(eq(roles.id, roleId));
  await audit(admin.id, "delete", "role", roleId, { name: role.name });
  revalidatePath("/admin", "layout");
}
