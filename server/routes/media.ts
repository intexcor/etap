// Аудио и MP4 курсов: доступ по правам курса или по внутреннему токену рендерера.
import { Router } from "express";
import path from "node:path";
import { MEDIA_DIR } from "../config";
import { notFound } from "../errors";
import { RENDER_TOKEN } from "../render";
import { canView, getCourseRow } from "../repo";

export const mediaRouter = Router();

mediaRouter.get("/media/:courseId/{*file}", (req, res) => {
  const courseId = req.params.courseId;
  const parts = req.params.file as unknown as string[] | string | undefined;
  const rel = Array.isArray(parts) ? parts.join("/") : (parts ?? "");
  const course = getCourseRow(courseId);
  const byToken = req.query.t === RENDER_TOKEN;
  if (!course || (!byToken && !canView(course, req.user?.id))) throw notFound();

  const root = path.join(MEDIA_DIR, courseId);
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep)) throw notFound();
  res.sendFile(file, { maxAge: "7d", immutable: true }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "Файл не найден" });
  });
});
