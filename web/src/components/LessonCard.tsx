// Карточка ролика: превью-кадр рендерится на клиенте из сцен (без серверных постеров).
import { Thumbnail } from "@remotion/player";
import { Check, HelpCircle } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import type { LessonCard as LessonCardData } from "../../../shared/api";
import { LessonVideo } from "../../../remotion/Lesson";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "../../../remotion/timing";
import { formatDuration } from "./ui";

export function LessonPoster({ lesson, className = "" }: { lesson: Pick<LessonCardData, "id" | "position" | "title" | "scenes">; className?: string }) {
  const inputProps = useMemo(() => ({ lesson: { index: lesson.position, title: lesson.title, scenes: lesson.scenes }, mediaBase: "" }), [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`overflow-hidden bg-bg ${className}`}>
      <Thumbnail
        component={LessonVideo}
        inputProps={inputProps}
        frameToDisplay={Math.min(45, lessonFrames(lesson) - 1)}
        durationInFrames={lessonFrames(lesson)}
        compositionWidth={WIDTH}
        compositionHeight={HEIGHT}
        fps={FPS}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export function LessonCard({ lesson }: { lesson: LessonCardData }) {
  return (
    <Link to={`/c/${lesson.courseId}#${lesson.id}`} className="group block">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line transition group-hover:border-accent/60">
        <LessonPoster lesson={lesson} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
          <div className="line-clamp-2 text-sm font-bold leading-snug text-white">{lesson.title}</div>
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
          {formatDuration(lesson.duration)}
        </div>
        {lesson.completed && (
          <div className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-ok text-white">
            <Check size={14} />
          </div>
        )}
        {lesson.quizCount > 0 && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] text-white/80">
            <HelpCircle size={12} /> {lesson.quizCount}
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="truncate text-xs text-muted">
          {lesson.courseTitle} · {lesson.position + 1}/{lesson.lessonsInCourse}
        </div>
        <div className="truncate text-[11px] text-muted/70">{lesson.owner.name}</div>
      </div>
    </Link>
  );
}

export const CardGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{children}</div>
);
