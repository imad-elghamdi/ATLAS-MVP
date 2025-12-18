import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { Errors, AppError } from "./errors";
import { logger } from "../logger";
import { config } from "../config";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

export function authGuard(req: Request, _res: Response, next: NextFunction) {
  const token = (req.header("authorization") || "").replace("Bearer ", "").trim();
  if (!token) return next(Errors.unauthorized("Missing bearer token"));
  if (token !== config.authDevToken) return next(Errors.unauthorized("Invalid token"));
  (req as any).userId = "user_dev";
  next();
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).requestId;

  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code, status: err.status, details: err.details }, err.message);
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details }, requestId });
  }

  logger.error({ requestId, err }, "unhandled_error");
  const e = Errors.internal();
  return res.status(e.status).json({ error: { code: e.code, message: e.message }, requestId });
}
