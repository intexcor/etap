import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../shared/api";
import { attachUser } from "./auth";
import { LOCAL_MODEL, MODEL, PROVIDER, REGISTRATION_OPEN, ROOT } from "./config";
import { errorHandler, notFoundHandler } from "./errors";
import { authRouter } from "./routes/auth";
import { coursesRouter } from "./routes/courses";
import { lessonsRouter } from "./routes/lessons";
import { mediaRouter } from "./routes/media";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use(attachUser);

  app.get("/api/config", (_req, res) => {
    const config: AppConfig = {
      provider: PROVIDER,
      model: PROVIDER === "claude" ? MODEL : PROVIDER === "none" ? "extractive" : LOCAL_MODEL,
      registrationOpen: REGISTRATION_OPEN,
    };
    res.json(config);
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", authRouter, coursesRouter, lessonsRouter);
  app.use(mediaRouter);
  app.use("/api", notFoundHandler);

  // Собранный фронтенд (после vite build); в dev его отдаёт Vite с прокси.
  const dist = path.join(ROOT, "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: "1y", immutable: true, setHeaders: (res, file) => {
      if (file.endsWith(".html") || file.endsWith("sw.js") || file.endsWith("manifest.webmanifest")) res.setHeader("cache-control", "no-cache");
    } }));
    app.get("/{*path}", (_req, res) => {
      res.setHeader("cache-control", "no-cache");
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
