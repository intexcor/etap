// Генерация курса: материал → план → уроки (сценарий + озвучка). Идемпотентно: при повторе
// доделывает только незавершённые уроки.
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import type { Outline, Quiz, Scene } from "../shared/schema";
import { MEDIA_DIR, UPLOADS_DIR } from "./config";
import { q, transaction } from "./db";
import { describeError, generateLesson, generateOutline, type Material } from "./generate";
import { log } from "./log";
import { registerHandler, type JobRow } from "./queue";
import { indexCourse, isIndexed } from "./rag";
import { pickVoice, synthesizeScenes } from "./tts";

const LESSON_CONCURRENCY = 3;

export const courseMediaDir = (courseId: string) => path.join(MEDIA_DIR, courseId);

export function saveUpload(courseId: string, file: { name: string; buffer: Buffer }): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const ext = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt";
  const target = path.join(UPLOADS_DIR, `${courseId}.${ext}`);
  fs.writeFileSync(target, file.buffer);
  return target;
}

export function loadMaterial(sourcePath: string, name: string, courseId?: string): Material {
  if (!fs.existsSync(sourcePath)) throw new Error("Исходный файл материала не найден");
  return sourcePath.endsWith(".pdf")
    ? { kind: "pdf", name, base64: fs.readFileSync(sourcePath).toString("base64"), courseId }
    : { kind: "text", name, text: fs.readFileSync(sourcePath, "utf8"), courseId };
}

// Убираем повторы вариантов (слабые модели дублируют) и перемешиваем:
// модели часто ставят верный ответ первым.
function normalizeQuiz(quiz: Quiz): Quiz | null {
  const correctText = quiz.options[Math.min(Math.max(quiz.correctIndex, 0), quiz.options.length - 1)];
  const options = [...new Set(quiz.options.map((o) => o.trim()).filter(Boolean))];
  if (options.length < 2 || correctText === undefined) return null;
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return { ...quiz, options: shuffled, correctIndex: shuffled.indexOf(correctText.trim()) };
}

// Зацепка — первой, вывод — последним, даже если модель перепутала порядок.
function orderScenes(scenes: Scene[]): Scene[] {
  const rank = (s: Scene) => (s.type === "hook" ? 0 : s.type === "summary" ? 2 : 1);
  return [...scenes].sort((a, b) => rank(a) - rank(b));
}

async function runPool(tasks: (() => Promise<void>)[], limit: number) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]();
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

type CourseJobRow = {
  id: string;
  source_name: string;
  source_path: string | null;
  outline_json: string | null;
  lessons_requested: string;
  voice: "female" | "male";
};

async function generateCourse(job: JobRow, report: (p: number) => void) {
  const courseId = job.course_id!;
  const course = q.get<CourseJobRow>(
    "select id, source_name, source_path, outline_json, lessons_requested, voice from courses where id = ?",
    courseId,
  );
  if (!course) return; // курс удалили, пока задача ждала
  const setCourse = (fields: Record<string, string | number | null>) => {
    const keys = Object.keys(fields);
    const sets = [...keys.map((k) => `${k} = ?`), "updated_at = ?"].join(", ");
    q.run(`update courses set ${sets} where id = ?`, ...keys.map((k) => fields[k]), Date.now(), courseId);
  };

  try {
    const material = loadMaterial(course.source_path ?? "", course.source_name, courseId);
    // Индекс для RAG: контекст уроков у локальных моделей и «Спросить материал».
    if (!isIndexed(courseId)) {
      setCourse({ status: "indexing" });
      await indexCourse(courseId, material);
    }

    let outline: Outline;
    if (course.outline_json) {
      outline = JSON.parse(course.outline_json);
    } else {
      setCourse({ status: "outlining", error: null });
      const requested = course.lessons_requested === "auto" ? "auto" : Number(course.lessons_requested);
      outline = await generateOutline(material, requested);
      if (!outline.concepts.length) throw new Error("Модель не нашла в материале тем для уроков");
      transaction(() => {
        setCourse({
          title: outline.courseTitle.trim() || course.source_name,
          language: outline.language,
          outline_json: JSON.stringify(outline),
          status: "generating",
        });
        outline.concepts.forEach((c, i) => {
          q.run(
            `insert into lessons (id, course_id, position, title, goal, source_excerpt, status, updated_at)
             values (?, ?, ?, ?, ?, ?, 'pending', ?)`,
            `l${i + 1}-${nanoid(6)}`,
            courseId,
            i,
            c.title,
            c.goal,
            c.sourceExcerpt,
            Date.now(),
          );
        });
      });
    }
    setCourse({ status: "generating" });

    const pending = q.all<{ id: string; position: number }>(
      "select id, position from lessons where course_id = ? and status != 'ready' order by position",
      courseId,
    );
    const total = outline.concepts.length;
    let done = total - pending.length;
    report(done / total);
    const voice = pickVoice(outline.language, course.voice);

    await runPool(
      pending.map(({ id, position }) => async () => {
        try {
          const draft = await generateLesson(material, outline, position);
          const scenes = await synthesizeScenes(orderScenes(draft.scenes), courseMediaDir(courseId), id, voice);
          const duration = scenes.reduce((s, sc) => s + (sc.audio?.duration ?? 3) + 0.7, 0);
          const quizzes = draft.quizzes.map(normalizeQuiz).filter((x): x is Quiz => x !== null);
          q.run(
            `update lessons set title = ?, status = 'ready', error = null, scenes_json = ?, quizzes_json = ?, duration = ?, updated_at = ?
             where id = ?`,
            draft.title.trim() || outline.concepts[position].title,
            JSON.stringify(scenes),
            JSON.stringify(quizzes),
            duration,
            Date.now(),
            id,
          );
        } catch (e) {
          log.warn({ courseId, lesson: id, err: e }, "lesson failed");
          q.run("update lessons set status = 'error', error = ?, updated_at = ? where id = ?", describeError(e), Date.now(), id);
        }
        report(++done / total);
        setCourse({});
      }),
      LESSON_CONCURRENCY,
    );

    const ready = q.get<{ n: number }>("select count(*) as n from lessons where course_id = ? and status = 'ready'", courseId)!.n;
    const firstError = q.get<{ error: string }>("select error from lessons where course_id = ? and status = 'error' limit 1", courseId);
    setCourse(ready ? { status: "ready", error: null } : { status: "error", error: firstError?.error ?? "Не получилось сгенерировать уроки" });
  } catch (e) {
    setCourse({ status: "error", error: describeError(e) });
    throw e;
  }
}

registerHandler("generate_course", generateCourse);
