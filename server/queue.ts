// Персистентная очередь задач в SQLite: переживает перезапуск, работает в одном процессе.
import { nanoid } from "nanoid";
import { q } from "./db";
import { log } from "./log";

export type JobType = "generate_course" | "render_lesson";
export type JobRow = {
  id: string;
  type: JobType;
  course_id: string | null;
  lesson_id: string | null;
  payload_json: string;
  status: "queued" | "running" | "done" | "error";
  progress: number;
};

type Handler = (job: JobRow, report: (progress: number) => void) => Promise<void>;

const LIMITS: Record<JobType, number> = { generate_course: 1, render_lesson: 1 };
const handlers = new Map<JobType, Handler>();
const running = new Map<JobType, number>();
let timer: NodeJS.Timeout | null = null;

export function registerHandler(type: JobType, handler: Handler) {
  handlers.set(type, handler);
}

export function enqueue(type: JobType, ref: { courseId?: string; lessonId?: string }, payload: object = {}) {
  const id = nanoid(12);
  q.run(
    "insert into jobs (id, type, course_id, lesson_id, payload_json, status, created_at) values (?, ?, ?, ?, ?, 'queued', ?)",
    id,
    type,
    ref.courseId ?? null,
    ref.lessonId ?? null,
    JSON.stringify(payload),
    Date.now(),
  );
  setImmediate(tick);
  return id;
}

export function hasActiveJob(type: JobType, ref: { courseId?: string; lessonId?: string }): boolean {
  const col = ref.lessonId ? "lesson_id" : "course_id";
  return !!q.get(
    `select 1 from jobs where type = ? and ${col} = ? and status in ('queued', 'running')`,
    type,
    ref.lessonId ?? ref.courseId ?? "",
  );
}

export function startWorker() {
  // Прерванные перезапуском задачи запускаем заново: обработчики идемпотентны.
  const n = q.run("update jobs set status = 'queued', started_at = null where status = 'running'").changes;
  if (n) log.info({ n }, "requeued interrupted jobs");
  timer = setInterval(tick, 1500);
  tick();
}

export function stopWorker() {
  if (timer) clearInterval(timer);
}

function tick() {
  for (const [type, handler] of handlers) {
    while ((running.get(type) ?? 0) < LIMITS[type]) {
      const job = q.get<JobRow>("select * from jobs where type = ? and status = 'queued' order by created_at limit ?", type, 1);
      if (!job) break;
      q.run("update jobs set status = 'running', started_at = ? where id = ?", Date.now(), job.id);
      running.set(type, (running.get(type) ?? 0) + 1);
      void run(job, handler);
    }
  }
}

async function run(job: JobRow, handler: Handler) {
  const started = Date.now();
  const report = (progress: number) => q.run("update jobs set progress = ? where id = ?", progress, job.id);
  try {
    await handler(job, report);
    q.run("update jobs set status = 'done', progress = 1, finished_at = ? where id = ?", Date.now(), job.id);
    log.info({ job: job.id, type: job.type, ms: Date.now() - started }, "job done");
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    q.run("update jobs set status = 'error', error = ?, finished_at = ? where id = ?", error, Date.now(), job.id);
    log.error({ job: job.id, type: job.type, err: e }, "job failed");
  } finally {
    running.set(job.type, (running.get(job.type) ?? 1) - 1);
    setImmediate(tick);
  }
}
