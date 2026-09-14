import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import type { VoiceGender } from "../shared/schema";
import { COURSES_DIR, LOCAL_MODEL, MODEL, PORT, PROVIDER, ROOT } from "./config";
import type { Material } from "./generate";
import { createCourse, runCourse } from "./jobs";
import { enqueueRender, mp4Path } from "./render";
import { getCourse, listCourses, recoverInterrupted, summarize } from "./store";

recoverInterrupted();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024 } });

app.get("/api/config", (_req, res) => {
  res.json({ provider: PROVIDER, model: PROVIDER === "local" ? LOCAL_MODEL : MODEL });
});

app.get("/api/courses", (_req, res) => {
  res.json(listCourses().map(summarize));
});

app.get("/api/courses/:id", (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return void res.status(404).json({ error: "Курс не найден" });
  res.json(course);
});

app.post("/api/courses", upload.single("file"), (req, res) => {
  const file = req.file;
  const text = String(req.body.text ?? "").trim();
  let material: Material;
  if (file) {
    // multer отдаёт имя в latin1
    const name = Buffer.from(file.originalname, "latin1").toString("utf8");
    material =
      file.mimetype === "application/pdf" || name.toLowerCase().endsWith(".pdf")
        ? { kind: "pdf", name, base64: file.buffer.toString("base64") }
        : { kind: "text", name, text: file.buffer.toString("utf8") };
  } else if (text) {
    material = { kind: "text", name: text.split("\n")[0].slice(0, 60), text };
  } else {
    return void res.status(400).json({ error: "Нужен файл или текст материала" });
  }

  const lessonsRaw = Number(req.body.lessons);
  const lessons = Number.isInteger(lessonsRaw) && lessonsRaw >= 1 && lessonsRaw <= 20 ? lessonsRaw : "auto";
  const voice: VoiceGender = req.body.voice === "male" ? "male" : "female";

  const course = createCourse(material.name, voice);
  void runCourse(course, material, lessons);
  res.json({ id: course.id });
});

app.post("/api/courses/:id/lessons/:lessonId/render", (req, res) => {
  if (!enqueueRender(req.params.id, req.params.lessonId)) {
    return void res.status(404).json({ error: "Урок не найден" });
  }
  res.json({ ok: true });
});

app.get("/api/courses/:id/lessons/:lessonId/mp4", (req, res) => {
  const course = getCourse(req.params.id);
  const lesson = course?.lessons.find((l) => l.id === req.params.lessonId);
  if (!course || !lesson || lesson.mp4?.status !== "done") return void res.status(404).end();
  const safeTitle = `${lesson.index + 1}. ${lesson.title}`.replace(/[\\/:*?"<>|]/g, "");
  res.download(mp4Path(course.id, lesson.id), `${safeTitle}.mp4`);
});

app.use("/media", express.static(COURSES_DIR, { fallthrough: false }));

const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () =>
  console.log(`LearnTok API: http://localhost:${PORT} · генерация: ${PROVIDER === "local" ? LOCAL_MODEL : MODEL}`),
);
