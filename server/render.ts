// MP4 через Remotion. Headless Chrome берёт аудио с этого же сервера по внутреннему токену.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { LessonProps } from "../remotion/Lesson";
import type { LessonScene } from "../shared/schema";
import { BROWSER_EXECUTABLE, PORT, ROOT } from "./config";
import { q } from "./db";
import { courseMediaDir } from "./pipeline";
import { registerHandler, type JobRow } from "./queue";

/** Токен для доступа рендерера к приватным медиа. Живёт, пока жив процесс. */
export const RENDER_TOKEN = randomBytes(16).toString("hex");

let bundled: Promise<string> | null = null;
const getBundle = () =>
  (bundled ??= bundle({ entryPoint: path.join(ROOT, "remotion", "index.ts") }).catch((e) => {
    bundled = null;
    throw e;
  }));

export const mp4Path = (courseId: string, lessonId: string) => path.join(courseMediaDir(courseId), "mp4", `${lessonId}.mp4`);

type RenderRow = { id: string; course_id: string; position: number; title: string; scenes_json: string; status: string };

export async function renderLesson(job: JobRow) {
  const lessonId = job.lesson_id!;
  const lesson = q.get<RenderRow>("select id, course_id, position, title, scenes_json, status from lessons where id = ?", lessonId);
  if (!lesson) return;
  const setMp4 = (status: string, progress: number, error: string | null = null) =>
    q.run("update lessons set mp4_status = ?, mp4_progress = ?, mp4_error = ?, updated_at = ? where id = ?", status, progress, error, Date.now(), lessonId);

  setMp4("rendering", 0);
  try {
    if (lesson.status !== "ready") throw new Error("Урок ещё не готов");
    const serveUrl = await getBundle();
    const inputProps: LessonProps = {
      lesson: { index: lesson.position, title: lesson.title, scenes: JSON.parse(lesson.scenes_json) as LessonScene[] },
      mediaBase: `http://127.0.0.1:${PORT}/media/${lesson.course_id}/`,
      mediaQuery: `?t=${RENDER_TOKEN}`,
    };
    const composition = await selectComposition({ serveUrl, id: "Lesson", inputProps, browserExecutable: BROWSER_EXECUTABLE });
    const out = mp4Path(lesson.course_id, lessonId);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    let lastSave = 0;
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: out,
      inputProps,
      browserExecutable: BROWSER_EXECUTABLE,
      // обычный Chrome вместо chrome-headless-shell не тянет несколько вкладок рендера
      concurrency: BROWSER_EXECUTABLE ? 1 : null,
      onProgress: ({ progress }) => {
        if (Date.now() - lastSave > 1000) {
          lastSave = Date.now();
          setMp4("rendering", progress);
        }
      },
    });
    setMp4("done", 1);
  } catch (e) {
    setMp4("error", 0, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

registerHandler("render_lesson", renderLesson);
