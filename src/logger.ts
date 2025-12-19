import pino from "pino";
import type { Request, Response, NextFunction } from "express";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration_ms = Date.now() - start;
    logger.info(
      {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        duration_ms,
      },
      "http_request"
    );
  });

  next();
}
