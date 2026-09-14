import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import { BROWSER_EXECUTABLE, PORT, ROOT } from "./config";
import { courseDir, getCourse, saveCourse } from "./store";

let bundled: Promise<string> | null = null;
const getBundle = () =>
  (bundled ??= bundle({ entryPoint: path.join(ROOT, "remotion", "index.ts") }).catch((e) => {
    bundled = null;
    throw e;
  }));

export const mp4Path = (courseId: string, lessonId: string) =>
  path.join(courseDir(courseId), "mp4", `${lessonId}.mp4`);

// Рендер тяжёлый (Chrome + ffmpeg), поэтому строго по одному.
let queue: Promise<void> = Promise.resolve();

export function enqueueRender(courseId: string, lessonId: string) {
  const course = getCourse(courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  if (!course || !lesson) return false;
  if (lesson.mp4?.status === "queued" || lesson.mp4?.status === "rendering") return true;
  lesson.mp4 = { status: "queued", progress: 0 };
  saveCourse(course);
  queue = queue.then(() => renderLesson(courseId, lessonId));
  return true;
}

export async function renderLesson(courseId: string, lessonId: string) {
  const course = getCourse(courseId)!;
  const lesson = course.lessons.find((l) => l.id === lessonId)!;
  lesson.mp4 = { status: "rendering", progress: 0 };
  saveCourse(course);
  try {
    const serveUrl = await getBundle();
    const { mp4: _, ...cleanLesson } = lesson;
    const inputProps = { lesson: cleanLesson, mediaBase: `http://127.0.0.1:${PORT}/media/${courseId}/` };
    const composition = await selectComposition({ serveUrl, id: "Lesson", inputProps, browserExecutable: BROWSER_EXECUTABLE });
    const out = mp4Path(courseId, lessonId);
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
        lesson.mp4 = { status: "rendering", progress };
        if (Date.now() - lastSave > 1000) {
          lastSave = Date.now();
          saveCourse(course);
        }
      },
    });
    lesson.mp4 = { status: "done", progress: 1 };
  } catch (e) {
    console.error(`Рендер ${courseId}/${lessonId}:`, e);
    lesson.mp4 = { status: "error", progress: 0, error: e instanceof Error ? e.message : String(e) };
  }
  saveCourse(course);
}
