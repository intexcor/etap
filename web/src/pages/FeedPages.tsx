import { Link, useLocation, useParams } from "react-router";
import { Button, Centered, ErrorBox, Spinner, formatDue } from "../components/ui";
import { FeedView } from "../feed/FeedView";
import { useFeed, useReview } from "../hooks";

export function CourseFeedPage() {
  const { id = "" } = useParams();
  const feed = useFeed(id);
  const startAt = useLocation().hash.slice(1) || undefined;

  if (feed.isPending) {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }
  if (feed.error) {
    return (
      <Centered>
        <ErrorBox>{feed.error.message}</ErrorBox>
        <Button variant="ghost" to="/">
          На главную
        </Button>
      </Centered>
    );
  }
  const { course, lessons } = feed.data;
  const busy = course.status === "queued" || course.status === "outlining" || course.status === "generating";

  const tail = (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      {busy ? (
        <>
          <Spinner />
          <h2 className="text-xl font-bold">Генерирую следующие уроки…</h2>
          <p className="text-sm text-muted">
            Готово {course.lessonsReady} из {course.lessonsTotal || "?"}. Лента дополнится сама.
          </p>
        </>
      ) : course.status === "error" && lessons.length === 0 ? (
        <>
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-bold">Не получилось</h2>
          <p className="text-sm text-muted">{course.error}</p>
        </>
      ) : (
        <>
          <div className="text-6xl">🎓</div>
          <h2 className="text-2xl font-extrabold">Курс пройден</h2>
          {course.progress && course.progress.answered > 0 && (
            <p className="text-sm text-muted">
              Верных ответов: {course.progress.correct} из {course.progress.answered}
            </p>
          )}
          <p className="text-sm text-muted">Темы вернутся в «Повтор», когда придёт время.</p>
        </>
      )}
      <div className="mt-2 flex gap-2">
        <Link to={`/c/${course.id}`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">
          К курсу
        </Link>
        <Link to="/" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">
          Мои курсы
        </Link>
      </div>
    </div>
  );

  return <FeedView title={course.title} backTo={`/c/${course.id}`} lessons={lessons} tail={tail} startAt={startAt} />;
}

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

  return <FeedView title={`Повторение · ${due.length}`} backTo="/" lessons={due} tail={tail} showCourseTitle />;
}
