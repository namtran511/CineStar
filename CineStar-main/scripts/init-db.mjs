import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const migrationDir = join(process.cwd(), "drizzle");
const files = readdirSync(migrationDir).filter(name => name.endsWith(".sql")).sort();
if (!files.length) throw new Error("No schema migrations found. Run npm run db:generate first.");
const hosting = JSON.parse(readFileSync(join(process.cwd(), ".openai", "hosting.json"), "utf8"));
if (!hosting.d1) throw new Error("Set the D1 binding to DB in .openai/hosting.json first.");
const runtimeDir = join(process.cwd(), ".sites-runtime");
mkdirSync(runtimeDir, { recursive: true });
const configPath = join(runtimeDir, "db-init.json");
writeFileSync(configPath, JSON.stringify({ name: "cineverse-db-init", compatibility_date: "2026-05-15", d1_databases: [{ binding: hosting.d1, database_name: "site-creator-d1", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: migrationDir }] }, null, 2));
// Wrangler records applied schema migrations in D1, so repeated runs are safe.
// Demo seed records are created separately by the server's first request.
const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "migrations", "apply", hosting.d1, "--local", "--persist-to", ".wrangler/state", "--config", configPath], { stdio: ["pipe", "inherit", "inherit"], input: "y\n", env: process.env });
if (result.status !== 0) process.exit(result.status || 1);
