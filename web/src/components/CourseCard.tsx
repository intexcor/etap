import { AlertTriangle, Globe, Link2, Lock } from "lucide-react";
import { Link } from "react-router";
import type { CourseSummary } from "../../../shared/api";
import { ProgressBar } from "./ui";

export const STATUS_LABEL: Record<CourseSummary["status"], string> = {
  queued: "В очереди",
  outlining: "Разбираю материал на темы…",
  generating: "Генерирую уроки…",
  ready: "Готово",
  error: "Ошибка",
};

export const VISIBILITY = {
  private: { label: "Только я", icon: Lock },
  link: { label: "По ссылке", icon: Link2 },
  public: { label: "Публичный", icon: Globe },
} as const;

export function CourseCard({ course, showOwner = false }: { course: CourseSummary; showOwner?: boolean }) {
  const busy = course.status === "queued" || course.status === "outlining" || course.status === "generating";
  const progress = course.progress;
  const Vis = VISIBILITY[course.visibility].icon;
  const done = progress ? progress.completed : 0;

  return (
    <Link
      to={`/c/${course.id}`}
      className="block rounded-2xl border border-line bg-panel p-4 transition hover:border-accent/50 hover:bg-panel-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-bold">{course.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {showOwner && <span>{course.owner.name}</span>}
            <span className="inline-flex items-center gap-1">
              <Vis size={12} /> {VISIBILITY[course.visibility].label}
            </span>
            <span>
              {course.lessonsReady} {plural(course.lessonsReady, "урок", "урока", "уроков")}
            </span>
          </div>
        </div>
        {course.status === "error" && <AlertTriangle className="shrink-0 text-bad" size={18} />}
      </div>

      {busy && (
        <div className="mt-3">
          <div className="mb-1.5 text-xs text-muted">
            {STATUS_LABEL[course.status]}
            {course.lessonsTotal > 0 && ` · ${course.lessonsReady}/${course.lessonsTotal}`}
          </div>
          <ProgressBar value={course.lessonsTotal ? course.lessonsReady / course.lessonsTotal : 0.05} />
        </div>
      )}
      {course.status === "error" && <div className="mt-2 text-xs text-bad">{course.error}</div>}
      {course.status === "ready" && progress && course.lessonsReady > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>Пройдено {done}/{course.lessonsReady}</span>
            {progress.answered > 0 && (
              <span>
                Верно {progress.correct}/{progress.answered}
              </span>
            )}
          </div>
          <ProgressBar value={done / course.lessonsReady} />
        </div>
      )}
    </Link>
  );
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
