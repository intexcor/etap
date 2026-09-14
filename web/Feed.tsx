import { Player, type PlayerRef } from "@remotion/player";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Course, Lesson, Quiz } from "../shared/schema";
import { LessonVideo } from "../remotion/Lesson";
import { Rich } from "../remotion/scenes";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "../remotion/timing";
import { api } from "./api";

type Item =
  | { kind: "lesson"; key: string; lesson: Lesson }
  | { kind: "quiz"; key: string; lesson: Lesson; quiz: Quiz }
  | { kind: "status"; key: string }
  | { kind: "end"; key: string };

type Answers = Record<string, { picked: number; correct: boolean }>;

const answersKey = (id: string) => `learntok:${id}:answers`;
function loadAnswers(id: string): Answers {
  try {
    return JSON.parse(localStorage.getItem(answersKey(id)) ?? "{}");
  } catch {
    return {};
  }
}

/** Уроки показываем только непрерывным префиксом, чтобы лента не сдвигалась при догенерации. */
function readyLessons(course: Course): Lesson[] {
  const byIndex = new Map(course.lessons.map((l) => [l.index, l]));
  const out: Lesson[] = [];
  for (let i = 0; i < course.total; i++) {
    const lesson = byIndex.get(i);
    if (lesson) out.push(lesson);
    else if (!course.failed.some((f) => f.index === i)) break;
  }
  return out;
}

export function Feed({ id }: { id: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loadError, setLoadError] = useState("");
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(id));
  const scroller = useRef<HTMLDivElement>(null);
  const players = useRef(new Map<string, PlayerRef>());

  const refresh = useCallback(() => api.course(id).then(setCourse, (e) => setLoadError(e.message)), [id]);
  useEffect(() => void refresh(), [refresh]);

  const generating = course?.status === "outlining" || course?.status === "generating";
  const rendering = course?.lessons.some((l) => l.mp4?.status === "queued" || l.mp4?.status === "rendering");
  useEffect(() => {
    if (!generating && !rendering) return;
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [generating, rendering, refresh]);

  const items = useMemo<Item[]>(() => {
    if (!course) return [];
    const list: Item[] = [];
    for (const lesson of readyLessons(course)) {
      list.push({ kind: "lesson", key: lesson.id, lesson });
      lesson.quizzes.forEach((quiz, n) => list.push({ kind: "quiz", key: `${lesson.id}-q${n}`, lesson, quiz }));
    }
    const hasPending = generating || (course.status === "error" && list.length === 0);
    list.push(hasPending ? { kind: "status", key: "status" } : { kind: "end", key: "end" });
    return list;
  }, [course, generating]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    Array.from(root.children).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  const goTo = useCallback((index: number) => {
    // scrollIntoView со smooth конфликтует со scroll-snap в Chrome
    const root = scroller.current;
    root?.scrollTo({ top: index * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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

  function answer(key: string, picked: number, correct: boolean) {
    const next = { ...answers, [key]: { picked, correct } };
    setAnswers(next);
    try {
      localStorage.setItem(answersKey(id), JSON.stringify(next));
    } catch {}
  }

  const answered = Object.keys(answers).length;
  const correct = Object.values(answers).filter((a) => a.correct).length;

  if (loadError) {
    return (
      <main className="home">
        <a href="#/">← назад</a>
        <p className="error">{loadError}</p>
      </main>
    );
  }

  return (
    <div className="feed">
      <header className="feed-top">
        <a className="pill" href="#/">
          ←
        </a>
        <span className="feed-title">{course?.title}</span>
        {answered > 0 && (
          <span className="pill">
            ✓ {correct}/{answered}
          </span>
        )}
      </header>

      <div className="scroller" ref={scroller}>
        {items.map((item, index) => (
          <section key={item.key} className="slide" data-index={index}>
            <div className="frame">
              {item.kind === "lesson" &&
                (Math.abs(index - active) <= 2 ? (
                  <VideoSlide
                    courseId={id}
                    lesson={item.lesson}
                    active={index === active}
                    started={started}
                    players={players.current}
                    onRender={() => api.render(id, item.lesson.id).then(refresh)}
                  />
                ) : (
                  <div className="placeholder">{item.lesson.title}</div>
                ))}
              {item.kind === "quiz" && (
                <QuizSlide
                  quiz={item.quiz}
                  state={answers[item.key]}
                  onAnswer={(picked) => answer(item.key, picked, picked === item.quiz.correctIndex)}
                  onReplay={() => goTo(items.findIndex((it) => it.key === item.lesson.id))}
                  onNext={() => goTo(index + 1)}
                />
              )}
              {item.kind === "status" && course && <StatusSlide course={course} />}
              {item.kind === "end" && course && (
                <div className="center-slide">
                  <div className="big">🎓</div>
                  <h2>Курс пройден</h2>
                  {answered > 0 && (
                    <p>
                      Верных ответов: {correct} из {answered}
                    </p>
                  )}
                  {course.failed.length > 0 && <p className="muted">Не удалось сгенерировать уроков: {course.failed.length}</p>}
                  <div className="quiz-actions">
                    <button className="ghost" onClick={() => goTo(0)}>
                      ↑ В начало
                    </button>
                    <a className="primary" href="#/">
                      Новый курс
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {!started && items[0]?.kind === "lesson" && (
        <button className="start" onClick={start}>
          ▶ Смотреть
        </button>
      )}
    </div>
  );
}

function VideoSlide({
  courseId,
  lesson,
  active,
  started,
  players,
  onRender,
}: {
  courseId: string;
  lesson: Lesson;
  active: boolean;
  started: boolean;
  players: Map<string, PlayerRef>;
  onRender: () => void;
}) {
  const ref = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const duration = lessonFrames(lesson);
  // Опрос курса пересоздаёт объект урока — не дёргаем плеер новыми пропсами без нужды.
  const inputProps = useMemo(() => ({ lesson, mediaBase: `/media/${courseId}/` }), [lesson.id, courseId]);

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
    return () => {
      players.delete(lesson.id);
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [lesson.id, players]);

  useEffect(() => {
    const player = ref.current;
    if (!player) return;
    if (active && started) {
      player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [active, started]);

  const mp4 = lesson.mp4;
  return (
    <>
      <div className="player" onClick={() => started && ref.current?.toggle()}>
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
        {started && active && !playing && <div className="paused">▶</div>}
      </div>

      {showSource && (
        <div className="source" onClick={() => setShowSource(false)}>
          <b>Цель:</b> {lesson.goal}
          <br />
          <br />
          <b>Из материала:</b> «{lesson.sourceExcerpt}»
        </div>
      )}

      <div className="dock">
        <button className="dock-btn" title="Источник" onClick={() => setShowSource((v) => !v)}>
          📄
        </button>
        <button className="dock-btn" title="Сначала" onClick={() => (ref.current?.seekTo(0), ref.current?.play())}>
          ↺
        </button>
        {!mp4 || mp4.status === "error" ? (
          <button className="dock-btn" title={mp4?.error ?? "Собрать MP4 для TikTok / Reels"} onClick={onRender}>
            {mp4?.status === "error" ? "⚠︎" : "MP4"}
          </button>
        ) : mp4.status === "done" ? (
          <a className="dock-btn" title="Скачать MP4" href={api.mp4Url(courseId, lesson.id)}>
            ⬇
          </a>
        ) : (
          <span className="dock-btn" title="Рендер MP4">
            {Math.round(mp4.progress * 100)}%
          </span>
        )}
      </div>
      <div className="progress">
        <i style={{ width: `${(frame / Math.max(1, duration - 1)) * 100}%` }} />
      </div>
    </>
  );
}

function QuizSlide({
  quiz,
  state,
  onAnswer,
  onReplay,
  onNext,
}: {
  quiz: Quiz;
  state?: { picked: number; correct: boolean };
  onAnswer: (picked: number) => void;
  onReplay: () => void;
  onNext: () => void;
}) {
  return (
    <div className="quiz">
      <div className="tag">Проверь себя</div>
      <h2>
        <Rich text={quiz.question} />
      </h2>
      {quiz.options.map((option, i) => {
        const cls = !state ? "" : i === quiz.correctIndex ? "correct" : i === state.picked ? "wrong" : "dim";
        return (
          <button key={i} className={`opt ${cls}`} disabled={!!state} onClick={() => onAnswer(i)}>
            <Rich text={option} />
          </button>
        );
      })}
      {state && (
        <>
          <div className="explain">
            <b>{state.correct ? "Верно! " : "Не совсем. "}</b>
            <Rich text={quiz.explanation} />
          </div>
          <div className="quiz-actions">
            {!state.correct && (
              <button className="ghost" onClick={onReplay}>
                ↺ Пересмотреть
              </button>
            )}
            <button className="primary" onClick={onNext}>
              Дальше ↓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusSlide({ course }: { course: Course }) {
  if (course.status === "error") {
    return (
      <div className="center-slide">
        <div className="big">⚠️</div>
        <h2>Не получилось</h2>
        <p className="muted">{course.error}</p>
        <a className="primary" href="#/">
          Назад
        </a>
      </div>
    );
  }
  const done = course.lessons.length + course.failed.length;
  return (
    <div className="center-slide">
      <div className="spinner" />
      <h2>{course.status === "outlining" ? "Разбираю материал на темы…" : "Генерирую уроки…"}</h2>
      {course.total > 0 && (
        <p className="muted">
          Готово {done} из {course.total}. Уже готовые можно смотреть — листай вверх.
        </p>
      )}
    </div>
  );
}
