import pg from "pg";
import { config } from "../config";
import { logger } from "../logger";

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (err) => {
  logger.error({ err }, "pg_pool_error");
});
