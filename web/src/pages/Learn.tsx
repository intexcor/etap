import { useRef } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Button, Centered, ErrorBox, Spinner, formatDue } from "../components/ui";
import { useCourse, useFeed, useReview } from "../hooks";
import { LearnView } from "../learn/LearnView";

/** /c/:id — экран обучения курса. */
export function CourseLearnPage() {
  const { id = "" } = useParams();
  const course = useCourse(id);
  const feed = useFeed(id);
  const hashStart = useLocation().hash.slice(1) || undefined;
  // Стартовый урок фиксируем один раз: иначе после обновления прогресса лента прыгала бы к следующему.
  const startRef = useRef<string | undefined>(undefined);

  if (course.isPending || feed.isPending) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  const error = course.error ?? feed.error;
  if (error || !course.data || !feed.data) {
    return (
      <Centered>
        <ErrorBox>{error?.message ?? "Курс не найден"}</ErrorBox>
        <Button variant="ghost" to="/">
          На главную
        </Button>
      </Centered>
    );
  }
  const c = course.data;
  const lessons = feed.data.lessons;
  const busy = c.status === "queued" || c.status === "indexing" || c.status === "outlining" || c.status === "generating";
  if (startRef.current === undefined) {
    const firstUnfinished = lessons.find((l) => !l.progress.completed);
    startRef.current = hashStart ?? (c.progress && c.progress.completed > 0 ? firstUnfinished?.id : undefined) ?? "";
  }

  const tail = (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {busy ? (
        <>
          <Spinner />
          <h2 className="text-xl font-bold">{lessons.length ? "Генерирую следующие уроки…" : "Готовлю первый урок…"}</h2>
          <p className="text-sm text-muted">
            {c.lessonsTotal ? `Готово ${c.lessonsReady} из ${c.lessonsTotal}.` : "Разбираю материал на темы."} Экран обновится сам.
          </p>
        </>
      ) : c.status === "error" && lessons.length === 0 ? (
        <>
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold">Не получилось</h2>
          <p className="text-sm text-muted">{c.error}</p>
        </>
      ) : (
        <>
          <div className="text-6xl">🎓</div>
          <h2 className="text-2xl font-extrabold">Курс пройден</h2>
          {c.progress && c.progress.answered > 0 && (
            <p className="text-sm text-muted">
              Верных ответов: {c.progress.correct} из {c.progress.answered}
            </p>
          )}
          <p className="text-sm text-muted">Темы вернутся в «Повтор», когда придёт время.</p>
        </>
      )}
      <div className="mt-2 flex gap-2">
        <Link to="/" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
          Мои курсы
        </Link>
        <Link to="/explore" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">
          Обзор
        </Link>
      </div>
    </div>
  );

  return (
    <LearnView
      key={c.id}
      mode="course"
      title={c.title}
      backTo="/"
      course={c}
      lessons={lessons}
      tail={tail}
      startAt={startRef.current || undefined}
    />
  );
}

/** /review — лента повторений. */
export function ReviewPage() {
  const review = useReview();

  if (review.isPending) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (review.error) {
    return (
      <Centered>
        <ErrorBox>{review.error.message}</ErrorBox>
      </Centered>
    );
  }
  const { due, nextDueAt } = review.data;

  if (due.length === 0) {
    return (
      <Centered>
        <div className="text-6xl">🧠</div>
        <div className="text-lg font-bold text-text">На сегодня всё повторено</div>
        <p className="max-w-xs text-sm">
          {nextDueAt ? `Следующее повторение: ${formatDue(nextDueAt).replace("повтор ", "")}.` : "Пройди пару уроков — темы начнут возвращаться сюда по расписанию: через день, три дня, неделю."}
        </p>
        <Button variant="ghost" to="/">
          К курсам
        </Button>
      </Centered>
    );
  }

  const tail = (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="text-6xl">✅</div>
      <h2 className="text-2xl font-extrabold">Повторение закончено</h2>
      <p className="text-sm text-muted">Интервалы пересчитаны по твоим ответам.</p>
      <Link to="/" className="mt-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
        Мои курсы
      </Link>
    </div>
  );

  return <LearnView mode="review" title={`Повторение · ${due.length}`} backTo="/" lessons={due} tail={tail} />;
}
