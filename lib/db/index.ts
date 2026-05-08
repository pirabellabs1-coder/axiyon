/**
 * Drizzle client connected to Vercel Postgres (Neon).
 *
 * Uses HTTP transport (`drizzle-orm/neon-http`) — no WebSocket pool, no module-load
 * connection attempt, no risk of hanging serverless cold starts. Each query is a
 * standalone HTTP fetch which Neon optimises with their pooler.
 */
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

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

// One shared HTTP client per cold start.
declare global {
  // eslint-disable-next-line no-var
  var __axion_sql: ReturnType<typeof neon> | undefined;
}

const sqlClient = globalThis.__axion_sql ?? neon(url());
if (process.env.NODE_ENV !== "production") globalThis.__axion_sql = sqlClient;

export const db = drizzle(sqlClient, { schema });

// Backwards-compat alias for any code still importing `dbHttp`.
export const dbHttp = db;

// Re-export the schema so callers do `import { db, users } from "@/lib/db"`.
export * from "./schema";
