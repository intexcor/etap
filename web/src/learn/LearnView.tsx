// Экран обучения: уроки слева, плеер в центре, «Урок / Спросить» справа. На телефоне — полноэкранная
// лента со шторкой. Квиз всплывает поверх ролика, когда он досмотрен; дальше — следующий урок.
import { Player, type PlayerRef } from "@remotion/player";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  Globe,
  Info,
  Link2,
  Lock,
  MessageCircleQuestion,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Share2,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientQuiz, CourseDetail, FeedLesson, LessonSummary, QuizState } from "../../../shared/api";
import { LessonVideo } from "../../../remotion/Lesson";
import { Rich } from "../../../remotion/scenes";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "../../../remotion/timing";
import { api } from "../api";
import { AskPanel } from "../components/AskPanel";
import { STATUS_LABEL, plural } from "../components/CourseCard";
import { ProgressBar, Select, Spinner, formatDuration } from "../components/ui";
import { useInvalidateProgress, useMe } from "../hooks";

export type LearnViewProps = {
  title: string;
  backTo: string;
  lessons: FeedLesson[];
  /** Курс с настройками и полным списком уроков (в режиме повторения — нет). */
  course?: CourseDetail;
  /** Слайд в конце: итоги / статус генерации. */
  tail: ReactNode;
  startAt?: string;
  mode: "course" | "review";
};

type Phase = "watch" | "quiz" | "done";

export function LearnView({ title, backTo, lessons, course, tail, startAt, mode }: LearnViewProps) {
  const me = useMe();
  const invalidate = useInvalidateProgress();
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, QuizState>>({});
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [panel, setPanel] = useState<"lesson" | "ask">("lesson");
  const [sheet, setSheet] = useState<null | "lessons" | "lesson" | "ask">(null);
  const scroller = useRef<HTMLDivElement>(null);
  const players = useRef(new Map<string, PlayerRef>());
  const completedRef = useRef(new Set<string>());

  const slides = useMemo(() => [...lessons.map((l) => ({ kind: "lesson" as const, key: l.id, lesson: l })), { kind: "tail" as const, key: "tail" }], [lessons]);
  const current = slides[active]?.kind === "lesson" ? (slides[active] as { lesson: FeedLesson }).lesson : null;

  useEffect(() => {
    const fromServer: Record<string, QuizState> = {};
    for (const l of lessons) for (const [i, a] of Object.entries(l.progress.answers)) fromServer[`${l.id}-q${i}`] = a;
    setAnswers((prev) => ({ ...fromServer, ...prev }));
  }, [lessons]);

  const goTo = useCallback((index: number) => {
    const root = scroller.current;
    if (!root) return;
    root.scrollTo({ top: index * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!startAt || !slides.length) return;
    const index = slides.findIndex((s) => s.key === startAt);
    if (index > 0) {
      const root = scroller.current;
      root?.scrollTo({ top: index * root.clientHeight });
      setActive(index);
    }
  }, [startAt, slides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    Array.from(root.children).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "j") goTo(Math.min(active + 1, slides.length - 1));
      else if (e.key === "ArrowUp" || e.key === "k") goTo(Math.max(active - 1, 0));
      else if (e.key === " " && current) players.current.get(current.id)?.toggle();
      else if (e.key === "Escape") setSheet(null);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active, slides.length, current, goTo]);

  function start() {
    setStarted(true);
    if (current) players.current.get(current.id)?.play();
  }

  const onEnded = useCallback(
    (lesson: FeedLesson) => {
      setPhase((p) => ({ ...p, [lesson.id]: lesson.quizzes.length ? "quiz" : "done" }));
      if (!me.data || completedRef.current.has(lesson.id)) return;
      completedRef.current.add(lesson.id);
      api.progress(lesson.id, { completed: true, watched: true }).then(invalidate, () => completedRef.current.delete(lesson.id));
    },
    [me.data, invalidate],
  );

  async function answer(lesson: FeedLesson, index: number, picked: number) {
    if (!me.data) return;
    const result = await api.answer(lesson.id, { quizIndex: index, picked });
    setAnswers((prev) => ({ ...prev, [`${lesson.id}-q${index}`]: result }));
    invalidate();
  }

  function rewatch(lesson: FeedLesson) {
    setPhase((p) => ({ ...p, [lesson.id]: "watch" }));
    const player = players.current.get(lesson.id);
    player?.seekTo(0);
    player?.play();
  }

  const next = () => goTo(Math.min(active + 1, slides.length - 1));
  const lessonIndex = current ? lessons.findIndex((l) => l.id === current.id) : -1;

  const sidebar = (
    <Sidebar
      title={title}
      backTo={backTo}
      course={course}
      lessons={lessons}
      mode={mode}
      activeId={current?.id ?? null}
      onPick={(id) => {
        const i = slides.findIndex((s) => s.key === id);
        if (i >= 0) goTo(i);
        setSheet(null);
      }}
    />
  );
  const rightPanel = current && (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-line p-2">
        <Tab active={panel === "lesson"} onClick={() => setPanel("lesson")} icon={<Info size={15} />} label="Урок" />
        <Tab active={panel === "ask"} onClick={() => setPanel("ask")} icon={<MessageCircleQuestion size={15} />} label="Спросить" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {panel === "lesson" ? (
          <LessonInfo lesson={current} answers={answers} />
        ) : (
          <AskPanel courseId={current.courseId} canAsk={!!me.data} pages={course?.pages ?? 0} embedded />
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 flex bg-bg">
      <aside className="hidden w-[300px] shrink-0 flex-col border-r border-line bg-panel md:flex">{sidebar}</aside>

      <div className="relative min-w-0 flex-1 bg-black">
        <div ref={scroller} className="snap-feed h-full overflow-y-auto">
          {slides.map((slide, index) => (
            <section key={slide.key} className="snap-slide flex h-[100dvh] items-center justify-center" data-index={index}>
              <div className="relative aspect-[9/16] h-[100dvh] max-w-[100vw] overflow-hidden bg-bg md:h-[calc(100dvh-32px)] md:rounded-3xl">
                {slide.kind === "lesson" ? (
                  Math.abs(index - active) <= 1 ? (
                    <LessonSlide
                      lesson={slide.lesson}
                      courseTitle={mode === "review" ? slide.lesson.courseTitle : undefined}
                      active={index === active}
                      started={started}
                      players={players.current}
                      phase={phase[slide.lesson.id] ?? "watch"}
                      answers={answers}
                      canAnswer={!!me.data}
                      isLast={index === slides.length - 2}
                      onEnded={() => onEnded(slide.lesson)}
                      onAnswer={(i, picked) => answer(slide.lesson, i, picked)}
                      onRewatch={() => rewatch(slide.lesson)}
                      onNext={next}
                      onOpen={(s) => setSheet(s)}
                    />
                  ) : (
                    <div className="grid h-full place-items-center px-6 text-center text-muted">{slide.lesson.title}</div>
                  )
                ) : (
                  tail
                )}
              </div>
            </section>
          ))}
        </div>

        {/* Верхняя плашка на телефоне */}
        <header className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 py-2 md:hidden">
          <Link to={backTo} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
            <ArrowLeft size={18} />
          </Link>
          <button onClick={() => setSheet("lessons")} className="pointer-events-auto min-w-0 truncate rounded-full bg-black/45 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
            {title}
            {lessonIndex >= 0 && ` · ${lessonIndex + 1}/${lessons.length}`}
          </button>
        </header>

        {/* Стрелки на десктопе */}
        <div className="pointer-events-none absolute inset-y-0 right-4 z-10 hidden flex-col items-center justify-center gap-2 md:flex">
          <Arrow onClick={() => goTo(Math.max(active - 1, 0))} disabled={active === 0}>
            <ChevronUp size={22} />
          </Arrow>
          <Arrow onClick={next} disabled={active >= slides.length - 1}>
            <ChevronDown size={22} />
          </Arrow>
          <span className="mt-2 text-[11px] text-white/40">↑ ↓ · пробел</span>
        </div>

        {!started && current && (
          <button
            onClick={start}
            className="absolute bottom-[14%] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-base font-extrabold text-white shadow-[0_10px_40px_rgba(139,108,255,0.45)]"
          >
            <Volume2 size={20} /> Смотреть со звуком
          </button>
        )}

        {/* Шторка на телефоне */}
        {sheet && (
          <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/60 md:hidden" onClick={() => setSheet(null)}>
            <div className="max-h-[80%] overflow-hidden rounded-t-3xl border-t border-line bg-panel" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 pt-3">
                <div className="h-1 w-10 rounded-full bg-line" />
                <button onClick={() => setSheet(null)} className="grid h-8 w-8 place-items-center text-muted">
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[70dvh] overflow-y-auto">
                {sheet === "lessons" && sidebar}
                {sheet === "lesson" && current && (
                  <div className="p-4">
                    <LessonInfo lesson={current} answers={answers} />
                  </div>
                )}
                {sheet === "ask" && current && (
                  <div className="p-4">
                    <AskPanel courseId={current.courseId} canAsk={!!me.data} pages={course?.pages ?? 0} embedded />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="hidden w-[360px] shrink-0 border-l border-line bg-panel lg:block">{rightPanel}</aside>
    </div>
  );
}

const Tab = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold ${active ? "bg-accent/15 text-accent" : "text-muted hover:text-text"}`}
  >
    {icon} {label}
  </button>
);

const Arrow = ({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur disabled:opacity-25"
  >
    {children}
  </button>
);

function Sidebar({
  title,
  backTo,
  course,
  lessons,
  mode,
  activeId,
  onPick,
}: {
  title: string;
  backTo: string;
  course?: CourseDetail;
  lessons: FeedLesson[];
  mode: "course" | "review";
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const busy = course && (course.status === "queued" || course.status === "indexing" || course.status === "outlining" || course.status === "generating");
  const refresh = () => course && qc.invalidateQueries({ queryKey: ["course", course.id] });

  async function share() {
    if (!course) return;
    const url = `${location.origin}/c/${course.id}`;
    try {
      if (navigator.share) await navigator.share({ title: course.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  }

  async function remove() {
    if (!course || !confirm(`Удалить курс «${course.title}» со всеми уроками?`)) return;
    await api.deleteCourse(course.id);
    await qc.invalidateQueries({ queryKey: ["courses"] });
    navigate("/", { replace: true });
  }

  const list: (LessonSummary | FeedLesson)[] = course ? course.lessons : lessons;
  const done = course?.progress?.completed ?? 0;
  const readyCount = course ? course.lessons.filter((l) => l.status === "ready").length : lessons.length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-4">
        <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-text">
          <ArrowLeft size={14} /> {mode === "review" ? "К курсам" : "Мои курсы"}
        </Link>
        <h1 className="text-base font-extrabold leading-snug">{title}</h1>
        {course && (
          <div className="mt-1 text-xs text-muted">
            {course.owner.name} · {readyCount} {plural(readyCount, "урок", "урока", "уроков")}
            {course.pages > 0 && ` · ${course.pages} стр.`}
          </div>
        )}
        {course && readyCount > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-muted">
              <span>
                Пройдено {done}/{readyCount}
              </span>
              {course.progress && course.progress.answered > 0 && (
                <span>
                  верно {course.progress.correct}/{course.progress.answered}
                </span>
              )}
            </div>
            <ProgressBar value={done / readyCount} />
          </div>
        )}
        {course?.isOwner && (
          <div className="mt-3 flex items-center gap-1.5">
            <Select
              value={course.visibility}
              onChange={async (e) => {
                await api.updateCourse(course.id, { visibility: e.target.value as CourseDetail["visibility"] });
                refresh();
                void qc.invalidateQueries({ queryKey: ["courses"] });
              }}
              className="flex-1 !py-1.5 text-xs"
            >
              <option value="private">Только я</option>
              <option value="link">По ссылке</option>
              <option value="public">Публичный</option>
            </Select>
            <IconBtn title={copied ? "Скопировано" : "Поделиться"} onClick={share}>
              {course.visibility === "private" ? <Lock size={15} /> : course.visibility === "link" ? <Link2 size={15} /> : <Globe size={15} />}
              <Share2 size={15} />
            </IconBtn>
            <IconBtn title="Удалить курс" onClick={remove} danger>
              <Trash2 size={15} />
            </IconBtn>
          </div>
        )}
      </div>

      {course && busy && (
        <div className="border-b border-line px-4 py-3 text-xs">
          <div className="mb-1.5 flex items-center gap-2">
            <Spinner className="!h-3.5 !w-3.5 !border-2" /> {STATUS_LABEL[course.status]}
            {course.lessonsTotal > 0 && (
              <span className="text-muted">
                {course.lessonsReady}/{course.lessonsTotal}
              </span>
            )}
          </div>
          <ProgressBar value={course.lessonsTotal ? course.lessonsReady / course.lessonsTotal : 0.05} />
        </div>
      )}
      {course?.status === "error" && (
        <div className="border-b border-line px-4 py-3 text-xs">
          <div className="flex items-start gap-2 text-bad">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {course.error}
          </div>
          {course.isOwner && (
            <button onClick={async () => (await api.retryCourse(course.id), refresh())} className="mt-2 inline-flex items-center gap-1 text-accent">
              <RefreshCw size={12} /> Повторить генерацию
            </button>
          )}
        </div>
      )}

      <ol className="min-h-0 flex-1 overflow-y-auto p-2">
        {list.map((l, i) => {
          const isFeed = "scenes" in l;
          const status = isFeed ? "ready" : l.status;
          const completed = isFeed ? l.progress.completed : !!l.progress?.completed;
          const isActive = l.id === activeId;
          const mp4 = l.mp4;
          return (
            <li key={l.id}>
              <button
                disabled={status !== "ready"}
                onClick={() => onPick(l.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${isActive ? "bg-accent/15" : "hover:bg-panel-2"} disabled:opacity-50`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${completed ? "bg-ok/20 text-ok" : isActive ? "bg-accent text-white" : "bg-line text-muted"}`}
                >
                  {completed ? <Check size={14} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${isActive ? "font-bold" : "font-medium"}`}>{l.title}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {status === "pending" && "Генерируется…"}
                    {status === "error" && <span className="text-bad">{(l as LessonSummary).error}</span>}
                    {status === "ready" && (
                      <>
                        {formatDuration(l.duration)} · {(isFeed ? l.quizzes.length : l.quizCount) || "без"} {plural(isFeed ? l.quizzes.length : l.quizCount, "вопрос", "вопроса", "вопросов")}
                        {mode === "review" && isFeed && ` · ${l.courseTitle}`}
                      </>
                    )}
                  </span>
                </span>
                {course?.isOwner && status === "ready" && (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                    title={mp4?.status === "done" ? "Скачать MP4" : mp4?.status === "error" ? `Ошибка: ${mp4.error}` : "Собрать MP4"}
                  >
                    {mp4?.status === "done" ? (
                      <a href={api.mp4Url(l.id)} className="grid h-7 w-7 place-items-center rounded-full text-accent hover:bg-panel-2">
                        <Download size={14} />
                      </a>
                    ) : mp4 && mp4.status !== "error" ? (
                      <span className="text-[10px] text-muted">{mp4.status === "queued" ? "…" : `${Math.round(mp4.progress * 100)}%`}</span>
                    ) : (
                      <button onClick={async () => (await api.render(l.id), refresh())} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:text-text">
                        {mp4?.status === "error" ? <AlertTriangle size={14} className="text-bad" /> : <Film size={14} />}
                      </button>
                    )}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const IconBtn = ({ children, onClick, title, danger }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) => (
  <button
    onClick={onClick}
    title={title}
    className={`flex h-8 items-center gap-1 rounded-lg border px-2 ${danger ? "border-bad/40 text-bad hover:bg-bad/10" : "border-line text-muted hover:text-text"}`}
  >
    {children}
  </button>
);

function LessonInfo({ lesson, answers }: { lesson: FeedLesson; answers: Record<string, QuizState> }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-muted">Урок {lesson.position + 1}</div>
        <h2 className="mt-1 text-lg font-extrabold leading-snug">{lesson.title}</h2>
        <p className="mt-2 text-muted">{lesson.goal}</p>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Из материала</div>
        <blockquote className="border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-muted">{lesson.sourceExcerpt}</blockquote>
      </div>
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Сцены</div>
        <ol className="flex flex-col gap-1 text-[13px]">
          {lesson.scenes.map((s, i) => (
            <li key={i} className="flex gap-2 text-muted">
              <span className="w-4 text-right">{i + 1}.</span>
              <span className="min-w-0 truncate">
                <span className="text-text/80">{s.type}</span> · {s.narration.slice(0, 80)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {lesson.quizzes.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-muted">Вопросы</div>
          <ol className="flex flex-col gap-1.5">
            {lesson.quizzes.map((qz, i) => {
              const a = answers[`${lesson.id}-q${i}`];
              return (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${!a ? "bg-line" : a.correct ? "bg-ok" : "bg-bad"}`} />
                  <span className="text-muted">
                    <Rich text={qz.question} />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function LessonSlide({
  lesson,
  courseTitle,
  active,
  started,
  players,
  phase,
  answers,
  canAnswer,
  isLast,
  onEnded,
  onAnswer,
  onRewatch,
  onNext,
  onOpen,
}: {
  lesson: FeedLesson;
  courseTitle?: string;
  active: boolean;
  started: boolean;
  players: Map<string, PlayerRef>;
  phase: Phase;
  answers: Record<string, QuizState>;
  canAnswer: boolean;
  isLast: boolean;
  onEnded: () => void;
  onAnswer: (index: number, picked: number) => Promise<void>;
  onRewatch: () => void;
  onNext: () => void;
  onOpen: (s: "lesson" | "ask") => void;
}) {
  const ref = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const duration = lessonFrames(lesson);
  const inputProps = useMemo(
    () => ({ lesson: { index: lesson.position, title: lesson.title, scenes: lesson.scenes, courseTitle }, mediaBase: "" }),
    [lesson.id, courseTitle], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    players.set(lesson.id, player);
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    player.addEventListener("ended", onEnded);
    return () => {
      players.delete(lesson.id);
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
      player.removeEventListener("ended", onEnded);
    };
  }, [lesson.id, players, onEnded]);

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    if (active && started && phase === "watch") {
      player.seekTo(0);
      player.play();
    } else if (!active) player.pause();
  }, [active, started]); // eslint-disable-line react-hooks/exhaustive-deps

  const showOverlay = active && phase !== "watch";
  return (
    <>
      <div className="absolute inset-0" onClick={() => started && !showOverlay && ref.current?.toggle()}>
        <Player
          ref={ref}
          component={LessonVideo}
          inputProps={inputProps}
          durationInFrames={duration}
          fps={FPS}
          compositionWidth={WIDTH}
          compositionHeight={HEIGHT}
          style={{ width: "100%", height: "100%" }}
          clickToPlay={false}
          acknowledgeRemotionLicense
        />
        {started && active && !playing && !showOverlay && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-white/85 drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
            <Play size={64} fill="currentColor" />
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-3 z-10 flex gap-2">
        <Dock title="Об уроке" onClick={() => onOpen("lesson")} className="lg:hidden">
          <Info size={16} />
        </Dock>
        <Dock title="Спросить материал" onClick={() => onOpen("ask")} className="lg:hidden">
          <MessageCircleQuestion size={16} />
        </Dock>
        <Dock title="Сначала" onClick={onRewatch}>
          <RotateCcw size={16} />
        </Dock>
        {started && (
          <Dock title={playing ? "Пауза" : "Играть"} onClick={() => ref.current?.toggle()}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </Dock>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
        <div className="h-full bg-white" style={{ width: `${(frame / Math.max(1, duration - 1)) * 100}%` }} />
      </div>

      {showOverlay && (
        <QuizOverlay lesson={lesson} answers={answers} canAnswer={canAnswer} isLast={isLast} onAnswer={onAnswer} onRewatch={onRewatch} onNext={onNext} />
      )}
    </>
  );
}

const Dock = ({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={`grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur ${className}`} {...rest}>
    {children}
  </button>
);

/** Квиз поверх досмотренного ролика: вопрос за вопросом, потом «следующий урок». */
function QuizOverlay({
  lesson,
  answers,
  canAnswer,
  isLast,
  onAnswer,
  onRewatch,
  onNext,
}: {
  lesson: FeedLesson;
  answers: Record<string, QuizState>;
  canAnswer: boolean;
  isLast: boolean;
  onAnswer: (index: number, picked: number) => Promise<void>;
  onRewatch: () => void;
  onNext: () => void;
}) {
  const firstUnanswered = lesson.quizzes.findIndex((_, i) => !answers[`${lesson.id}-q${i}`]);
  const [index, setIndex] = useState(firstUnanswered === -1 ? lesson.quizzes.length : firstUnanswered);
  const [busy, setBusy] = useState(false);
  const quiz: ClientQuiz | undefined = lesson.quizzes[index];
  const state = quiz ? answers[`${lesson.id}-q${index}`] : undefined;
  const finished = !quiz;
  const [countdown, setCountdown] = useState<number | null>(null);

  // Без вопросов — автопереход через 4 с.
  useEffect(() => {
    if (!finished || isLast) return;
    setCountdown(4);
    const t = setInterval(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearInterval(t);
  }, [finished, isLast]);
  useEffect(() => {
    if (countdown === 0) onNext();
  }, [countdown, onNext]);

  const correct = lesson.quizzes.filter((_, i) => answers[`${lesson.id}-q${i}`]?.correct).length;

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-bg via-bg/95 to-bg/40 px-5 pb-6 pt-24">
      {quiz ? (
        <>
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-widest text-accent">
            <span>Проверь себя</span>
            <span className="text-muted">
              {index + 1}/{lesson.quizzes.length}
            </span>
          </div>
          <h2 className="mb-3 text-xl font-bold leading-snug">
            <Rich text={quiz.question} />
          </h2>
          <div className="flex flex-col gap-2">
            {quiz.options.map((option, i) => {
              const cls = !state
                ? "border-line bg-panel/90 hover:border-accent"
                : i === state.correctIndex
                  ? "border-ok bg-ok/15"
                  : i === state.picked
                    ? "border-bad bg-bad/15"
                    : "border-line bg-panel/60 opacity-50";
              return (
                <button
                  key={i}
                  disabled={!!state || busy || !canAnswer}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onAnswer(index, i);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className={`rounded-2xl border px-4 py-3 text-left text-[15px] leading-snug backdrop-blur transition disabled:cursor-default ${cls}`}
                >
                  <Rich text={option} />
                </button>
              );
            })}
          </div>
          {!canAnswer && (
            <p className="mt-2 text-xs text-muted">
              <Link to="/login" className="text-accent">
                Войди
              </Link>
              , чтобы отвечать и сохранять прогресс.
            </p>
          )}
          {state && (
            <div className="mt-3 rounded-2xl border border-line bg-bg/90 px-4 py-3 text-sm leading-relaxed">
              <b className={state.correct ? "text-ok" : "text-bad"}>{state.correct ? "Верно! " : "Не совсем. "}</b>
              <Rich text={state.explanation} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onRewatch} className="rounded-xl border border-line bg-panel/80 px-4 py-2.5 text-sm font-semibold">
              ↺ Пересмотреть
            </button>
            {state && (
              <button onClick={() => setIndex(index + 1)} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
                {index + 1 < lesson.quizzes.length ? "Следующий вопрос" : "Готово"}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 pb-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-ok/20 text-ok">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-extrabold">Урок пройден</h2>
          {lesson.quizzes.length > 0 && (
            <p className="text-sm text-muted">
              Верно {correct} из {lesson.quizzes.length}
              {correct < lesson.quizzes.length && " — тема вернётся в повторении"}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button onClick={onRewatch} className="rounded-xl border border-line bg-panel/80 px-4 py-2.5 text-sm font-semibold">
              ↺ Пересмотреть
            </button>
            {!isLast && (
              <button onClick={onNext} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                Следующий урок {countdown !== null && countdown > 0 && `· ${countdown}`}
              </button>
            )}
            {isLast && (
              <button onClick={onNext} className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                Итоги
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
