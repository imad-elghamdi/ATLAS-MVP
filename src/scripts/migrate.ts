import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "../db/client";
import logger from "../logger";

async function main() {
  const sqlPath = resolve(process.cwd(), "migrations/001_atlas_v1.sql");
  const sql = readFileSync(sqlPath, "utf-8");
  await pool.query(sql);
  logger.info("migration_applied_001_atlas_v1");
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, "migration_failed");
  process.exit(1);
});
