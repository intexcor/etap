// Вертикальная лента: ролик → квизы → следующий ролик. Общая для курса и повторений.
import { Player, type PlayerRef } from "@remotion/player";
import { ArrowLeft, Download, FileText, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { ClientQuiz, FeedLesson, QuizState } from "../../../shared/api";
import { LessonVideo } from "../../../remotion/Lesson";
import { Rich } from "../../../remotion/scenes";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "../../../remotion/timing";
import { api } from "../api";
import { useInvalidateProgress, useMe } from "../hooks";

type Item =
  | { kind: "lesson"; key: string; lesson: FeedLesson }
  | { kind: "quiz"; key: string; lesson: FeedLesson; quiz: ClientQuiz; index: number }
  | { kind: "custom"; key: string; node: ReactNode };

export type FeedViewProps = {
  title: string;
  backTo: string;
  lessons: FeedLesson[];
  /** Слайд в конце ленты (итоги, статус генерации). */
  tail?: ReactNode;
  /** id урока, с которого начать (из hash). */
  startAt?: string;
  showCourseTitle?: boolean;
};

export function FeedView({ title, backTo, lessons, tail, startAt, showCourseTitle }: FeedViewProps) {
  const me = useMe();
  const invalidate = useInvalidateProgress();
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, QuizState>>({});
  const [session, setSession] = useState({ answered: 0, correct: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const players = useRef(new Map<string, PlayerRef>());
  const completedRef = useRef(new Set<string>());

  const items = useMemo<Item[]>(() => {
    const list: Item[] = [];
    for (const lesson of lessons) {
      list.push({ kind: "lesson", key: lesson.id, lesson });
      lesson.quizzes.forEach((quiz, index) => list.push({ kind: "quiz", key: `${lesson.id}-q${index}`, lesson, quiz, index }));
    }
    if (tail) list.push({ kind: "custom", key: "tail", node: tail });
    return list;
  }, [lessons, tail]);

  // Ответы с сервера (первая попытка) — чтобы уже отвеченные квизы показывались отвеченными.
  useEffect(() => {
    const fromServer: Record<string, QuizState> = {};
    for (const l of lessons) for (const [i, a] of Object.entries(l.progress.answers)) fromServer[`${l.id}-q${i}`] = a;
    setAnswers((prev) => ({ ...fromServer, ...prev }));
  }, [lessons]);

  const goTo = useCallback((index: number) => {
    const root = scroller.current;
    // scrollIntoView со smooth конфликтует со scroll-snap в Chrome
    root?.scrollTo({ top: index * root.clientHeight, behavior: "smooth" });
  }, []);

  // Стартовая позиция из #lessonId
  useEffect(() => {
    if (!startAt || !items.length) return;
    const index = items.findIndex((it) => it.key === startAt);
    if (index > 0) {
      const root = scroller.current;
      root?.scrollTo({ top: index * root.clientHeight });
      setActive(index);
    }
  }, [startAt, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "j") goTo(Math.min(active + 1, items.length - 1));
      else if (e.key === "ArrowUp" || e.key === "k") goTo(Math.max(active - 1, 0));
      else if (e.key === " ") {
        const item = items[active];
        if (item?.kind === "lesson") players.current.get(item.key)?.toggle();
      } else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active, items, goTo]);

  function start() {
    setStarted(true);
    const item = items[active];
    // play() внутри жеста пользователя — иначе браузер не даст включить звук
    if (item?.kind === "lesson") players.current.get(item.key)?.play();
  }

  const onLessonEnded = useCallback(
    (lesson: FeedLesson) => {
      if (!me.data || completedRef.current.has(lesson.id)) return;
      completedRef.current.add(lesson.id);
      api.progress(lesson.id, { completed: true, watched: true }).then(invalidate, () => completedRef.current.delete(lesson.id));
    },
    [me.data, invalidate],
  );

  async function answer(item: Extract<Item, { kind: "quiz" }>, picked: number) {
    if (!me.data) return;
    const result = await api.answer(item.lesson.id, { quizIndex: item.index, picked });
    setAnswers((prev) => ({ ...prev, [item.key]: result }));
    setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (result.correct ? 1 : 0) }));
    invalidate();
  }

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <header className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center gap-2 px-3 py-2 text-sm">
        <Link to={backTo} className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
          <ArrowLeft size={18} />
        </Link>
        <span className="truncate rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">{title}</span>
        {session.answered > 0 && (
          <span className="pointer-events-auto ml-auto rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            ✓ {session.correct}/{session.answered}
          </span>
        )}
      </header>

      <div ref={scroller} className="snap-feed h-full overflow-y-auto">
        {items.map((item, index) => (
          <section key={item.key} className="snap-slide flex h-[100dvh] items-center justify-center" data-index={index}>
            <div className="relative aspect-[9/16] h-[100dvh] max-w-[100vw] overflow-hidden bg-bg md:h-[calc(100dvh-32px)] md:rounded-2xl">
              {item.kind === "lesson" &&
                (Math.abs(index - active) <= 1 ? (
                  <VideoSlide
                    lesson={item.lesson}
                    active={index === active}
                    started={started}
                    players={players.current}
                    showCourseTitle={showCourseTitle}
                    onEnded={() => onLessonEnded(item.lesson)}
                  />
                ) : (
                  <div className="grid h-full place-items-center px-6 text-center text-muted">{item.lesson.title}</div>
                ))}
              {item.kind === "quiz" && (
                <QuizSlide
                  quiz={item.quiz}
                  state={answers[item.key]}
                  canAnswer={!!me.data}
                  onAnswer={(picked) => answer(item, picked)}
                  onReplay={() => goTo(items.findIndex((it) => it.key === item.lesson.id))}
                  onNext={index + 1 < items.length ? () => goTo(index + 1) : undefined}
                />
              )}
              {item.kind === "custom" && item.node}
            </div>
          </section>
        ))}
      </div>

      {!started && items[active]?.kind === "lesson" && (
        <button
          onClick={start}
          className="fixed bottom-[14%] left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-base font-extrabold text-white shadow-[0_10px_40px_rgba(139,108,255,0.45)]"
        >
          <Volume2 size={20} /> Смотреть со звуком
        </button>
      )}
    </div>
  );
}

function VideoSlide({
  lesson,
  active,
  started,
  players,
  showCourseTitle,
  onEnded,
}: {
  lesson: FeedLesson;
  active: boolean;
  started: boolean;
  players: Map<string, PlayerRef>;
  showCourseTitle?: boolean;
  onEnded: () => void;
}) {
  const ref = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const duration = lessonFrames(lesson);
  const inputProps = useMemo(
    () => ({ lesson: { index: lesson.position, title: lesson.title, scenes: lesson.scenes }, mediaBase: "" }),
    [lesson.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    players.set(lesson.id, player);
    const onFrame = (e: { detail: { frame: number } }) => {
      setFrame(e.detail.frame);
      // loop включён, поэтому «ended» не приходит — ловим последние кадры
      if (e.detail.frame >= duration - 2) onEnded();
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      players.delete(lesson.id);
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [lesson.id, players, duration, onEnded]);

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    if (active && started) {
      player.seekTo(0);
      player.play();
    } else player.pause();
  }, [active, started]);

  const mp4 = lesson.mp4;
  return (
    <>
      <div className="absolute inset-0" onClick={() => started && ref.current?.toggle()}>
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
          loop
          acknowledgeRemotionLicense
        />
        {started && active && !playing && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-white/85 drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
            <Play size={64} fill="currentColor" />
          </div>
        )}
      </div>

      {showCourseTitle && (
        <div className="pointer-events-none absolute left-3 top-[6.5rem] rounded-full bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur">{lesson.courseTitle}</div>
      )}

      {showSource && (
        <div
          className="absolute inset-x-3 bottom-20 z-10 max-h-[45%] overflow-auto rounded-2xl border border-line bg-bg/95 p-4 text-[13px] leading-relaxed"
          onClick={() => setShowSource(false)}
        >
          <b>Цель:</b> {lesson.goal}
          <br />
          <br />
          <b>Из материала:</b> «{lesson.sourceExcerpt}»
        </div>
      )}

      <div className="absolute bottom-4 right-3 z-10 flex gap-2">
        <Dock title="Источник" onClick={() => setShowSource((v) => !v)}>
          <FileText size={16} />
        </Dock>
        <Dock title="Сначала" onClick={() => (ref.current?.seekTo(0), ref.current?.play())}>
          <RotateCcw size={16} />
        </Dock>
        {started && (
          <Dock title={playing ? "Пауза" : "Играть"} onClick={() => ref.current?.toggle()}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </Dock>
        )}
        {mp4?.status === "done" && (
          <a href={api.mp4Url(lesson.id)} className={dockCls} title="Скачать MP4">
            <Download size={16} />
          </a>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
        <div className="h-full bg-white" style={{ width: `${(frame / Math.max(1, duration - 1)) * 100}%` }} />
      </div>
    </>
  );
}

const dockCls = "grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur";
const Dock = ({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={dockCls} {...rest}>
    {children}
  </button>
);

function QuizSlide({
  quiz,
  state,
  canAnswer,
  onAnswer,
  onReplay,
  onNext,
}: {
  quiz: ClientQuiz;
  state?: QuizState;
  canAnswer: boolean;
  onAnswer: (picked: number) => Promise<void>;
  onReplay: () => void;
  onNext?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex h-full flex-col justify-center gap-2.5 overflow-y-auto bg-[radial-gradient(circle_at_15%_5%,rgba(139,108,255,0.25),transparent_55%)] px-5 pb-6 pt-16">
      <div className="text-xs font-extrabold uppercase tracking-widest text-accent">Проверь себя</div>
      <h2 className="mb-2 text-xl font-bold leading-snug">
        <Rich text={quiz.question} />
      </h2>
      {quiz.options.map((option, i) => {
        const cls = !state
          ? "border-line bg-panel hover:border-accent"
          : i === state.correctIndex
            ? "border-ok bg-ok/15"
            : i === state.picked
              ? "border-bad bg-bad/15"
              : "border-line bg-panel opacity-50";
        return (
          <button
            key={i}
            disabled={!!state || busy || !canAnswer}
            onClick={async () => {
              setBusy(true);
              try {
                await onAnswer(i);
              } finally {
                setBusy(false);
              }
            }}
            className={`rounded-2xl border px-4 py-3 text-left text-[15px] leading-snug transition disabled:cursor-default ${cls}`}
          >
            <Rich text={option} />
          </button>
        );
      })}
      {!canAnswer && (
        <p className="text-xs text-muted">
          <Link to="/login" className="text-accent">
            Войди
          </Link>
          , чтобы отвечать на вопросы и сохранять прогресс.
        </p>
      )}
      {state && (
        <>
          <div className="rounded-2xl border border-line bg-bg px-4 py-3 text-sm leading-relaxed text-[#d4d8f2]">
            <b>{state.correct ? "Верно! " : "Не совсем. "}</b>
            <Rich text={state.explanation} />
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            {!state.correct && (
              <button onClick={onReplay} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">
                ↺ Пересмотреть
              </button>
            )}
            {onNext && (
              <button onClick={onNext} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
                Дальше ↓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
