// Applies SQL migrations from ./drizzle. Run: npm run db:migrate
// (Stop `npm run dev` first when using local PGlite; it allows one process at a time.)
import { db } from "../lib/db";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

async function main() {
  const usingPg = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
  const migrationsFolder = "./drizzle";
  if (usingPg) await migratePg(db, { migrationsFolder });
  else await migratePglite(db as never, { migrationsFolder });
  console.log(`Migrations applied (${usingPg ? "Postgres" : "PGlite"}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
