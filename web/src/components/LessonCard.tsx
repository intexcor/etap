// Карточки как на YouTube: Shorts (9:16, заголовок под превью) и видео (16:9, аватар + заголовок + мета).
import { Thumbnail } from "@remotion/player";
import { Check, MoreVertical } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import type { CourseSummary, LessonCard as LessonCardData } from "../../../shared/api";
import { LessonVideo } from "../../../remotion/Lesson";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "../../../remotion/timing";
import { plural } from "./CourseCard";
import { formatDuration } from "./ui";

export function LessonPoster({ lesson, className = "", frame = 45 }: { lesson: Pick<LessonCardData, "id" | "position" | "title" | "scenes">; className?: string; frame?: number }) {
  const inputProps = useMemo(() => ({ lesson: { index: lesson.position, title: lesson.title, scenes: lesson.scenes }, mediaBase: "" }), [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = lessonFrames(lesson);
  return (
    <div className={`overflow-hidden bg-bg ${className}`}>
      <Thumbnail
        component={LessonVideo}
        inputProps={inputProps}
        frameToDisplay={Math.min(frame, total - 1)}
        durationInFrames={total}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        fps={FPS}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

const AVATAR_COLORS = ["#c2410c", "#0e7490", "#4d7c0f", "#7e22ce", "#b45309", "#be185d", "#1d4ed8", "#047857"];
export const Avatar = ({ name, size = 36, className = "" }: { name: string; size?: number; className?: string }) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42, background: AVATAR_COLORS[h % AVATAR_COLORS.length] }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
};

export function timeAgo(ts: number) {
  const d = (Date.now() - ts) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))} мин. назад`;
  if (d < 86400) return `${Math.floor(d / 3600)} ч. назад`;
  const days = Math.floor(d / 86400);
  if (days < 30) return `${days} ${plural(days, "день", "дня", "дней")} назад`;
  const months = Math.floor(days / 30);
  return `${months} ${plural(months, "месяц", "месяца", "месяцев")} назад`;
}

/** Shorts-карточка */
export function LessonCard({ lesson }: { lesson: LessonCardData }) {
  return (
    <Link to={`/c/${lesson.courseId}#${lesson.id}`} className="group block">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-panel">
        <LessonPoster lesson={lesson} className="h-full w-full" />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1 py-0.5 text-xs font-medium text-white">{formatDuration(lesson.duration)}</span>
        {lesson.completed && (
          <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white text-bg">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-medium leading-5">{lesson.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {lesson.courseTitle} · {lesson.position + 1}/{lesson.lessonsInCourse}
          </div>
        </div>
        <MoreVertical size={18} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}

/** Видео-карточка курса, 16:9: вертикальный постер на размытом фоне, как YouTube показывает вертикальные ролики. */
export function CourseVideoCard({ course, poster }: { course: CourseSummary; poster?: LessonCardData }) {
  const busy = course.status !== "ready" && course.status !== "error";
  return (
    <Link to={`/c/${course.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-panel">
        {poster ? (
          <>
            <LessonPoster lesson={poster} className="absolute inset-0 scale-[1.9] opacity-40 blur-xl" frame={30} />
            <LessonPoster lesson={poster} className="absolute inset-y-0 left-1/2 aspect-[9/16] -translate-x-1/2" frame={30} />
          </>
        ) : (
          <div className="grid h-full place-items-center text-4xl text-muted">{busy ? "⏳" : "📄"}</div>
        )}
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1 py-0.5 text-xs font-medium text-white">
          {course.lessonsReady} {plural(course.lessonsReady, "урок", "урока", "уроков")}
        </span>
        {course.progress && course.progress.completed > 0 && course.lessonsReady > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
            <span className="block h-full bg-accent" style={{ width: `${(course.progress.completed / course.lessonsReady) * 100}%` }} />
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-3">
        <Avatar name={course.owner.name} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-base font-medium leading-[22px]">{course.title}</div>
          <div className="mt-1 text-sm text-muted">{course.owner.name}</div>
          <div className="text-sm text-muted">
            {busy ? "Генерируется…" : course.status === "error" ? "Ошибка генерации" : `${course.pages ? `${course.pages} стр.` : "текст"} · ${timeAgo(course.createdAt)}`}
          </div>
        </div>
        <MoreVertical size={18} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export const ShortsGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{children}</div>
);
export const VideoGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
);
