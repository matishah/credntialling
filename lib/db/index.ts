import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

/**
 * DATABASE_URL=postgres://...  -> real Postgres (AWS RDS in production)
 * unset                        -> embedded PGlite stored in ./.data/pglite (local dev)
 */
function createDb(): DB {
  const url = process.env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    const pool = new Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 10,
    });
    return drizzlePg(pool, { schema });
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  mkdirSync(path.dirname(dir), { recursive: true });
  claimPgliteLock(dir);
  const client = new PGlite(dir);
  return drizzlePglite(client, { schema }) as unknown as DB;
}

/**
 * PGlite has no cross-process locking: a second process opening the same folder
 * (a build, the seed script, a second `next dev`) corrupts its WAL. Refuse instead.
 */
function claimPgliteLock(dir: string) {
  const lockFile = `${dir}.lock`;
  let holder = NaN;
  try {
    holder = Number(readFileSync(lockFile, "utf8"));
  } catch {}
  if (holder && holder !== process.pid && isAlive(holder)) {
    throw new Error(
      `The local database (${dir}) is already open in another process (PID ${holder}). ` +
        `Stop that process first – two processes using PGlite at once corrupts it.`,
    );
  }
  writeFileSync(lockFile, String(process.pid));
  process.once("exit", () => {
    try {
      if (Number(readFileSync(lockFile, "utf8")) === process.pid) rmSync(lockFile);
    } catch {}
  });
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

// Opened on first use, not on import, so `next build` (which imports every route) never touches it.
// Reused across hot reloads in dev, since PGlite allows a single opener.
const g = globalThis as unknown as { __credDb?: DB };
const getDb = () => (g.__credDb ??= createDb());

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
