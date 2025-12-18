import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || "",
  logLevel: process.env.LOG_LEVEL || "info",
  authDevToken: process.env.AUTH_DEV_TOKEN || "dev",
  activeRuleset: process.env.ACTIVE_RULESET || "atlas.v1.0.json"
};

if (!config.databaseUrl) {
  // API can still start for unit tests without DB, but will fail DB routes.
}
