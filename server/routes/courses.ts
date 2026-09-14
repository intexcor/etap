import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Feed } from "../../shared/api";
import { requireUser } from "../auth";
import { q, transaction } from "../db";
import { badRequest, parseBody } from "../errors";
import { courseMediaDir, saveUpload } from "../pipeline";
import { enqueue, hasActiveJob } from "../queue";
import { getCourseRow, listLessonRows, listOwnCourses, listPublicCourses, requireCourse, toCourseDetail, toCourseSummary, toFeedLesson } from "../repo";

export const coursesRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024 } });

coursesRouter.get("/courses", requireUser, (req, res) => {
  res.json(listOwnCourses(req.user!.id).map((c) => toCourseSummary(c, req.user!.id)));
});

coursesRouter.get("/explore", (req, res) => {
  res.json(listPublicCourses().map((c) => toCourseSummary(c, req.user?.id)));
});

coursesRouter.post("/courses", requireUser, upload.single("file"), (req, res) => {
  const body = parseBody(
    z.object({
      text: z.string().optional().default(""),
      lessons: z.coerce.number().int().min(1).max(20).optional().catch(undefined),
      voice: z.enum(["female", "male"]).catch("female"),
      visibility: z.enum(["private", "link", "public"]).catch("private"),
      title: z.string().trim().max(120).optional(),
    }),
    req.body,
  );
  const file = req.file;
  const text = body.text.trim();
  let source: { name: string; buffer: Buffer };
  if (file) {
    // multer отдаёт имя в latin1
    const name = Buffer.from(file.originalname, "latin1").toString("utf8");
    source = { name, buffer: file.buffer };
  } else if (text.length >= 40) {
    source = { name: `${text.split("\n")[0].slice(0, 60).trim()}.txt`, buffer: Buffer.from(text, "utf8") };
  } else {
    throw badRequest(text ? "Материал слишком короткий — нужно хотя бы пара абзацев" : "Нужен файл или текст материала");
  }

  const id = nanoid(10);
  const sourcePath = saveUpload(id, source);
  const now = Date.now();
  q.run(
    `insert into courses (id, owner_id, title, source_name, source_path, lessons_requested, voice, visibility, status, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    id,
    req.user!.id,
    body.title || source.name.replace(/\.(pdf|txt|md)$/i, ""),
    source.name,
    sourcePath,
    body.lessons ? String(body.lessons) : "auto",
    body.voice,
    body.visibility,
    now,
    now,
  );
  enqueue("generate_course", { courseId: id });
  res.status(201).json(toCourseSummary(getCourseRow(id)!, req.user!.id));
});

coursesRouter.get("/courses/:id", (req, res) => {
  res.json(toCourseDetail(requireCourse(String(req.params.id), req.user?.id), req.user?.id));
});

coursesRouter.patch("/courses/:id", requireUser, (req, res) => {
  const course = requireCourse(String(req.params.id), req.user!.id, { owner: true });
  const body = parseBody(
    z.object({ title: z.string().trim().min(1).max(120).optional(), visibility: z.enum(["private", "link", "public"]).optional() }),
    req.body,
  );
  q.run(
    "update courses set title = ?, visibility = ?, updated_at = ? where id = ?",
    body.title ?? course.title,
    body.visibility ?? course.visibility,
    Date.now(),
    course.id,
  );
  res.json(toCourseSummary(getCourseRow(course.id)!, req.user!.id));
});

coursesRouter.delete("/courses/:id", requireUser, (req, res) => {
  const course = requireCourse(String(req.params.id), req.user!.id, { owner: true });
  transaction(() => q.run("delete from courses where id = ?", course.id));
  fs.rmSync(courseMediaDir(course.id), { recursive: true, force: true });
  if (course.source_path) fs.rmSync(course.source_path, { force: true });
  res.json({ ok: true });
});

/** Повторно запустить генерацию: доделает уроки со статусом error/pending. */
coursesRouter.post("/courses/:id/retry", requireUser, (req, res) => {
  const course = requireCourse(String(req.params.id), req.user!.id, { owner: true });
  if (!hasActiveJob("generate_course", { courseId: course.id })) {
    q.run("update courses set status = 'queued', error = null, updated_at = ? where id = ?", Date.now(), course.id);
    enqueue("generate_course", { courseId: course.id });
  }
  res.json(toCourseSummary(getCourseRow(course.id)!, req.user!.id));
});

coursesRouter.get("/courses/:id/feed", (req, res) => {
  const course = requireCourse(String(req.params.id), req.user?.id);
  const feed: Feed = {
    course: toCourseSummary(course, req.user?.id),
    lessons: listLessonRows(course.id)
      .filter((l) => l.status === "ready")
      .map((l) => toFeedLesson(l, course, req.user?.id)),
  };
  res.json(feed);
});
