/**
 * Drizzle client connected to Vercel Postgres (Neon).
 *
 * Two clients:
 *   - `db`        : pooled (default for serverless functions)
 *   - `dbDirect`  : non-pooled (for migrations / long transactions)
 */
import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";

import * as schema from "./schema";

neonConfig.fetchConnectionCache = true;

function url(): string {
  const u = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!u) {
    throw new Error(
      "Missing POSTGRES_URL. Add Vercel Postgres to your project " +
        "or set DATABASE_URL in your environment.",
    );
  }
  return u;
}

// Pooled — for normal queries (uses Neon's built-in pgbouncer)
declare global {
  // eslint-disable-next-line no-var
  var __axion_pool: Pool | undefined;
}

export const pool: Pool =
  globalThis.__axion_pool ?? new Pool({ connectionString: url() });

if (process.env.NODE_ENV !== "production") globalThis.__axion_pool = pool;

export const db = drizzle(pool, { schema });

// HTTP-based — for serverless functions hitting one query (avoids pool overhead)
export const dbHttp = drizzleHttp(neon(url()), { schema });

// Re-export the schema so callers do `import { db, users } from "@/lib/db"`.
export * from "./schema";
