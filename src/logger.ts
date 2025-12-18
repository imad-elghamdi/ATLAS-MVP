import pino from "pino";
import pinoHttp from "pino-http";
import { config } from "./config";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ["req.headers.authorization", "*.apiKey", "*.accessToken"],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger,
  customProps: (req) => ({ requestId: (req as any).requestId }),
});
