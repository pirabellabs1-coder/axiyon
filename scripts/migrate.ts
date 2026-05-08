/**
 * Apply the 0000_initial.sql migration against the configured Postgres URL.
 *
 *   pnpm db:migrate
 *
 * Idempotent: if the migration has already been applied, the CREATE TYPE /
 * CREATE TABLE statements will fail and the script will report it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "@neondatabase/serverless";

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Set POSTGRES_URL or DATABASE_URL to a Postgres connection string.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const dir = join(process.cwd(), "lib", "db", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const path = join(dir, file);
  const content = readFileSync(path, "utf8");
  console.log(`▶ Applying ${file}…`);
  const statements = content
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("already exists")) {
        console.log(`  · skip (already exists): ${stmt.slice(0, 60)}…`);
      } else {
        console.error(`  ✗ failed: ${stmt.slice(0, 80)}…`);
        console.error(`    ${msg}`);
        process.exit(1);
      }
    }
  }
  console.log(`✓ ${file}`);
}

await pool.end();
console.log("\nAll migrations applied.");
