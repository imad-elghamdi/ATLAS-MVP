export type ErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "DB_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: unknown;
  constructor(code: ErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const Errors = {
  unauthorized: (msg = "Unauthorized") => new AppError("UNAUTHORIZED", 401, msg),
  validation: (details: unknown) => new AppError("VALIDATION_ERROR", 400, "Validation error", details),
  notFound: (msg = "Not found") => new AppError("NOT_FOUND", 404, msg),
  conflict: (msg: string, details?: unknown) => new AppError("CONFLICT", 409, msg, details),
  internal: (msg = "Internal error", details?: unknown) => new AppError("INTERNAL_ERROR", 500, msg, details),
  db: (msg = "Database error", details?: unknown) => new AppError("DB_ERROR", 500, msg, details),
};
