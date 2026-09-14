import { Router } from "express";
import fs from "node:fs";
import { z } from "zod";
import type { AnswerResult, ReviewFeed } from "../../shared/api";
import type { Quiz } from "../../shared/schema";
import { requireUser } from "../auth";
import { q } from "../db";
import { badRequest, notFound } from "../errors";
import { parseBody } from "../errors";
import { enqueue, hasActiveJob } from "../queue";
import { mp4Path } from "../render";
import { getCourseRow, getLessonRow, requireLesson, toFeedLesson, toLessonSummary } from "../repo";
import { dueCount, dueLessonIds, nextDueAt, scheduleAfterAnswer, scheduleAfterWatch } from "../review";

export const lessonsRouter = Router();

lessonsRouter.post("/lessons/:id/progress", requireUser, (req, res) => {
  const { lesson } = requireLesson(String(req.params.id), req.user!.id);
  const body = parseBody(z.object({ completed: z.boolean().optional(), watched: z.boolean().optional() }), req.body);
  const now = Date.now();
  q.run(
    `insert into lesson_progress (user_id, lesson_id, watched, completed_at, updated_at) values (?, ?, ?, ?, ?)
     on conflict(user_id, lesson_id) do update set
       watched = lesson_progress.watched + excluded.watched,
       completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at),
       updated_at = excluded.updated_at`,
    req.user!.id,
    lesson.id,
    body.watched ? 1 : 0,
    body.completed ? now : null,
    now,
  );
  // Урок без квизов иначе никогда не попадёт в повторения.
  if (body.completed && (JSON.parse(lesson.quizzes_json) as Quiz[]).length === 0) scheduleAfterWatch(req.user!.id, lesson.id);
  res.json(toLessonSummary(getLessonRow(lesson.id)!, req.user!.id).progress);
});

lessonsRouter.post("/lessons/:id/answer", requireUser, (req, res) => {
  const { lesson } = requireLesson(String(req.params.id), req.user!.id);
  const body = parseBody(z.object({ quizIndex: z.number().int().min(0), picked: z.number().int().min(0) }), req.body);
  const quizzes = JSON.parse(lesson.quizzes_json) as Quiz[];
  const quiz = quizzes[body.quizIndex];
  if (!quiz) throw notFound("Квиз не найден");
  if (body.picked >= quiz.options.length) throw badRequest("Нет такого варианта");

  const correct = body.picked === quiz.correctIndex;
  const first = !q.get("select 1 from quiz_answers where user_id = ? and lesson_id = ? and quiz_index = ?", req.user!.id, lesson.id, body.quizIndex);
  q.run(
    "insert into quiz_answers (user_id, lesson_id, quiz_index, picked, correct, created_at) values (?, ?, ?, ?, ?, ?)",
    req.user!.id,
    lesson.id,
    body.quizIndex,
    body.picked,
    correct ? 1 : 0,
    Date.now(),
  );
  // Расписание повторений двигает только первая попытка, иначе можно «накликать» интервал.
  const review = first ? scheduleAfterAnswer(req.user!.id, lesson.id, correct) : null;
  const result: AnswerResult = { picked: body.picked, correct, correctIndex: quiz.correctIndex, explanation: quiz.explanation, review };
  res.json(result);
});

lessonsRouter.post("/lessons/:id/render", requireUser, (req, res) => {
  const { lesson } = requireLesson(String(req.params.id), req.user!.id, { owner: true });
  if (lesson.status !== "ready") throw badRequest("Урок ещё не готов");
  if (!hasActiveJob("render_lesson", { lessonId: lesson.id })) {
    q.run("update lessons set mp4_status = 'queued', mp4_progress = 0, mp4_error = null where id = ?", lesson.id);
    enqueue("render_lesson", { courseId: lesson.course_id, lessonId: lesson.id });
  }
  res.json(toLessonSummary(getLessonRow(lesson.id)!, req.user!.id));
});

lessonsRouter.get("/lessons/:id/mp4", (req, res) => {
  const { lesson } = requireLesson(String(req.params.id), req.user?.id);
  const file = mp4Path(lesson.course_id, lesson.id);
  if (lesson.mp4_status !== "done" || !fs.existsSync(file)) throw notFound("MP4 ещё не собран");
  const safeTitle = `${lesson.position + 1}. ${lesson.title}`.replace(/[\\/:*?"<>|]/g, "");
  res.download(file, `${safeTitle}.mp4`);
});

lessonsRouter.get("/review", requireUser, (req, res) => {
  const userId = req.user!.id;
  const due = dueLessonIds(userId)
    .map((id) => getLessonRow(id))
    .flatMap((lesson) => {
      const course = lesson && getCourseRow(lesson.course_id);
      return lesson && course ? [toFeedLesson(lesson, course, userId)] : [];
    });
  const feed: ReviewFeed = { due, dueCount: dueCount(userId), nextDueAt: nextDueAt(userId) };
  res.json(feed);
});
