import express from "express";
import cors from "cors";
import { requestContext, authGuard, errorHandler } from "./http/middleware";
import { httpLogger } from "./logger";
import { buildRoutes } from "./routes";

export default function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use(requestContext);
  app.use(httpLogger);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // auth for MVP
  app.use(authGuard);

  app.use(buildRoutes());

  app.use(errorHandler);

  return app;
}
