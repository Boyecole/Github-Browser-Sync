import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const sql = neon(url);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | undefined = undefined;

function getDb() {
  if (_db === undefined) {
    _db = createDb();
  }
  if (!_db) {
    throw new Error(
      "DATABASE_URL is not configured. Please add your Neon Postgres connection string.",
    );
  }
  return _db;
}

// Lazy proxy: defers neon() call until the first actual DB operation.
// This prevents module-level crashes when DATABASE_URL is not yet set.
export const db = new Proxy({} as ReturnType<typeof createDb> & object, {
  get(_target, prop) {
    const realDb = getDb();
    return (realDb as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export { schema };
