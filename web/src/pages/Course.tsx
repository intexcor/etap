import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Clock, Download, Film, Play, RefreshCw, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { CourseDetail, LessonSummary } from "../../../shared/api";
import { api } from "../api";
import { STATUS_LABEL, VISIBILITY, plural } from "../components/CourseCard";
import { Button, Card, Centered, ErrorBox, Page, ProgressBar, Select, Spinner, formatDuration, formatDue } from "../components/ui";
import { useCourse, useMe } from "../hooks";

export function CoursePage() {
  const { id = "" } = useParams();
  const course = useCourse(id);
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (course.isPending) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (course.error) {
    return (
      <Page title="Курс">
        <ErrorBox>{course.error.message}</ErrorBox>
      </Page>
    );
  }
  const c = course.data;
  const busy = c.status === "queued" || c.status === "outlining" || c.status === "generating";
  const ready = c.lessons.filter((l) => l.status === "ready");
  const firstUnfinished = ready.find((l) => !l.progress?.completed) ?? ready[0];
  const refresh = () => qc.invalidateQueries({ queryKey: ["course", id] });

  async function share() {
    const url = `${location.origin}/c/${c.id}`;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  }

  async function remove() {
    if (!confirm(`Удалить курс «${c.title}» со всеми уроками?`)) return;
    await api.deleteCourse(c.id);
    await qc.invalidateQueries({ queryKey: ["courses"] });
    navigate("/", { replace: true });
  }

  return (
    <Page
      title={c.title}
      action={
        c.isOwner ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={share} title="Поделиться">
              <Share2 size={16} /> {copied ? "Скопировано" : "Ссылка"}
            </Button>
            <Button variant="danger" onClick={remove} title="Удалить курс">
              <Trash2 size={16} />
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{c.owner.name}</span>
        <span>·</span>
        <span>
          {c.lessonsReady} {plural(c.lessonsReady, "урок", "урока", "уроков")}
        </span>
        {c.isOwner && (
          <Select
            value={c.visibility}
            onChange={async (e) => {
              await api.updateCourse(c.id, { visibility: e.target.value as CourseDetail["visibility"] });
              await qc.invalidateQueries({ queryKey: ["course", id] });
              await qc.invalidateQueries({ queryKey: ["courses"] });
            }}
            className="ml-auto py-1.5 text-xs"
          >
            {(Object.keys(VISIBILITY) as (keyof typeof VISIBILITY)[]).map((v) => (
              <option key={v} value={v}>
                {VISIBILITY[v].label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {busy && (
        <Card className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Spinner className="!h-4 !w-4 !border-2" />
            {STATUS_LABEL[c.status]}
            {c.lessonsTotal > 0 && (
              <span className="text-muted">
                · {c.lessonsReady}/{c.lessonsTotal}
              </span>
            )}
          </div>
          <ProgressBar value={c.lessonsTotal ? c.lessonsReady / c.lessonsTotal : 0.05} />
          <p className="mt-2 text-xs text-muted">Готовые уроки можно смотреть, не дожидаясь остальных.</p>
        </Card>
      )}
      {c.status === "error" && (
        <Card className="mb-4 border-bad/40">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 shrink-0 text-bad" size={16} />
            <div>
              <div className="font-semibold text-bad">Генерация не удалась</div>
              <div className="text-muted">{c.error}</div>
            </div>
          </div>
          {c.isOwner && (
            <Button variant="ghost" className="mt-3" onClick={async () => (await api.retryCourse(c.id), refresh())}>
              <RefreshCw size={14} /> Повторить
            </Button>
          )}
        </Card>
      )}

      {ready.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Button to={`/c/${c.id}/feed${firstUnfinished ? `#${firstUnfinished.id}` : ""}`} className="px-5 py-3 text-base">
            <Play size={18} /> {c.progress && c.progress.completed > 0 ? "Продолжить" : "Смотреть ленту"}
          </Button>
          {c.progress && (
            <span className="text-sm text-muted">
              Пройдено {c.progress.completed}/{ready.length}
              {c.progress.answered > 0 && ` · верно ${c.progress.correct}/${c.progress.answered}`}
            </span>
          )}
          {!me.data && <span className="text-xs text-muted">Войди, чтобы сохранять прогресс</span>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {c.lessons.map((l) => (
          <LessonRow key={l.id} lesson={l} courseId={c.id} isOwner={c.isOwner} onChange={refresh} />
        ))}
      </div>
    </Page>
  );
}

function LessonRow({ lesson: l, courseId, isOwner, onChange }: { lesson: LessonSummary; courseId: string; isOwner: boolean; onChange: () => void }) {
  const done = l.progress?.completed;
  const mp4 = l.mp4;
  return (
    <Card className="flex items-center gap-3 !p-3">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-ok/20 text-ok" : l.status === "ready" ? "bg-accent/15 text-accent" : "bg-line text-muted"}`}
      >
        {done ? <Check size={16} /> : l.position + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{l.title}</div>
        <div className="truncate text-xs text-muted">
          {l.status === "pending" && "Генерируется…"}
          {l.status === "error" && <span className="text-bad">{l.error}</span>}
          {l.status === "ready" && (
            <>
              {formatDuration(l.duration)} · {l.quizCount} {plural(l.quizCount, "вопрос", "вопроса", "вопросов")}
              {l.progress?.dueAt && (
                <>
                  {" "}
                  · <Clock size={11} className="inline" /> {formatDue(l.progress.dueAt)}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {l.status === "ready" && (
        <div className="flex items-center gap-1.5">
          {mp4?.status === "done" ? (
            <a href={api.mp4Url(l.id)} className="grid h-9 w-9 place-items-center rounded-full border border-line text-accent hover:bg-panel-2" title="Скачать MP4">
              <Download size={16} />
            </a>
          ) : mp4 && mp4.status !== "error" ? (
            <span className="text-xs text-muted" title="Рендер MP4">
              {mp4.status === "queued" ? "в очереди" : `${Math.round(mp4.progress * 100)}%`}
            </span>
          ) : (
            isOwner && (
              <button
                onClick={async () => (await api.render(l.id), onChange())}
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted hover:text-text"
                title={mp4?.error ? `Ошибка: ${mp4.error}. Нажми, чтобы повторить` : "Собрать MP4 для TikTok / Reels"}
              >
                {mp4?.status === "error" ? <AlertTriangle size={16} className="text-bad" /> : <Film size={16} />}
              </button>
            )
          )}
          <a href={`/c/${courseId}/feed#${l.id}`} className="grid h-9 w-9 place-items-center rounded-full bg-accent/15 text-accent hover:bg-accent/25" title="Смотреть">
            <Play size={16} />
          </a>
        </div>
      )}
    </Card>
  );
}
