import fs from "node:fs";
import path from "node:path";
import type { Course, CourseSummary } from "../shared/schema";
import { COURSES_DIR } from "./config";

// Один экземпляр курса на процесс: генерация и рендер мутируют один и тот же объект.
const cache = new Map<string, Course>();

const ID_RE = /^[\w-]+$/;

export function courseDir(id: string) {
  return path.join(COURSES_DIR, id);
}

export function saveCourse(course: Course) {
  const dir = courseDir(course.id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "course.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(course, null, 2));
  fs.renameSync(file + ".tmp", file);
  cache.set(course.id, course);
}

export function getCourse(id: string): Course | null {
  if (!ID_RE.test(id)) return null;
  const cached = cache.get(id);
  if (cached) return cached;
  const file = path.join(courseDir(id), "course.json");
  if (!fs.existsSync(file)) return null;
  const course = JSON.parse(fs.readFileSync(file, "utf8")) as Course;
  cache.set(id, course);
  return course;
}

export function listCourses(): Course[] {
  if (!fs.existsSync(COURSES_DIR)) return [];
  return fs
    .readdirSync(COURSES_DIR)
    .map(getCourse)
    .filter((c): c is Course => c !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function summarize(c: Course): CourseSummary {
  return {
    id: c.id,
    title: c.title,
    sourceName: c.sourceName,
    createdAt: c.createdAt,
    status: c.status,
    error: c.error,
    total: c.total,
    done: c.lessons.length + c.failed.length,
  };
}

// Задачи живут в памяти процесса, после перезапуска их не продолжить.
export function recoverInterrupted() {
  for (const course of listCourses()) {
    let dirty = false;
    if (course.status === "outlining" || course.status === "generating") {
      course.status = course.lessons.length ? "ready" : "error";
      course.error = "Генерация прервана перезапуском сервера";
      dirty = true;
    }
    for (const lesson of course.lessons) {
      if (lesson.mp4 && (lesson.mp4.status === "queued" || lesson.mp4.status === "rendering")) {
        lesson.mp4 = { status: "error", progress: 0, error: "Рендер прерван перезапуском" };
        dirty = true;
      }
    }
    if (dirty) saveCourse(course);
  }
}
