import { Pool } from "pg";
import { config } from "../config";
import logger from "../logger";

export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (err: Error) => {
  logger.error({ err }, "pg_pool_error");
});
