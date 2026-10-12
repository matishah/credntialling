// Seeds default roles, the payer directory and a first admin. Safe to re-run.
// Run: npm run db:seed   (ADMIN_EMAIL / ADMIN_PASSWORD from .env.local, or a random password is printed)
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db";
import { DEFAULT_ROLES } from "../lib/permissions";
import { PAYER_CATALOG } from "../lib/payers";
import { hashPassword } from "../lib/password";

async function main() {
  for (const r of DEFAULT_ROLES) {
    await db
      .insert(schema.roles)
      .values({ ...r, isSystem: r.name === "Admin" })
      .onConflictDoNothing({ target: schema.roles.name });
  }
  // Admin always gets every permission, including ones added after first seed.
  await db
    .update(schema.roles)
    .set({ permissions: DEFAULT_ROLES[0].permissions })
    .where(eq(schema.roles.name, "Admin"));

  for (const p of PAYER_CATALOG) {
    await db.insert(schema.payers).values({ name: p.name }).onConflictDoNothing({ target: schema.payers.name });
  }

  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!existing) {
    const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    const [adminRole] = await db.select().from(schema.roles).where(eq(schema.roles.name, "Admin"));
    await db.insert(schema.users).values({
      name: "Administrator",
      email,
      passwordHash: await hashPassword(password),
      roleId: adminRole.id,
    });
    console.log(`Admin created: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Temporary password: ${password}`);
  } else {
    console.log(`Admin ${email} already exists.`);
  }
  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
