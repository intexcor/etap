// Интервальные повторения: упрощённый SM-2 на уровне урока.
import { q } from "./db";

const DAY = 24 * 3600 * 1000;

type ReviewRow = { interval_days: number; ease: number; reps: number; lapses: number };

/** Обновляет расписание после ответа на квиз (только первый ответ на квиз). */
export function scheduleAfterAnswer(userId: string, lessonId: string, correct: boolean) {
  const now = Date.now();
  const cur = q.get<ReviewRow>("select interval_days, ease, reps, lapses from reviews where user_id = ? and lesson_id = ?", userId, lessonId) ?? {
    interval_days: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
  };
  let { interval_days: interval, ease, reps, lapses } = cur;
  if (correct) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
    ease = Math.min(3, ease + 0.1);
    reps += 1;
  } else {
    // Ошибка: показать снова завтра, дальше заново с короткими интервалами.
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
    reps = 0;
    lapses += 1;
  }
  const dueAt = now + interval * DAY;
  q.run(
    `insert into reviews (user_id, lesson_id, due_at, interval_days, ease, reps, lapses, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(user_id, lesson_id) do update set due_at = excluded.due_at, interval_days = excluded.interval_days,
       ease = excluded.ease, reps = excluded.reps, lapses = excluded.lapses, updated_at = excluded.updated_at`,
    userId,
    lessonId,
    dueAt,
    interval,
    ease,
    reps,
    lapses,
    now,
  );
  return { dueAt, intervalDays: interval };
}

/** Просмотр урока без квизов тоже ставит первое повторение — через день. */
export function scheduleAfterWatch(userId: string, lessonId: string) {
  const now = Date.now();
  q.run(
    `insert into reviews (user_id, lesson_id, due_at, interval_days, ease, reps, lapses, updated_at)
     values (?, ?, ?, 1, 2.5, 0, 0, ?) on conflict(user_id, lesson_id) do nothing`,
    userId,
    lessonId,
    now + DAY,
    now,
  );
}

export function dueLessonIds(userId: string, limit = 20): string[] {
  return q
    .all<{ lesson_id: string }>(
      `select r.lesson_id from reviews r join lessons l on l.id = r.lesson_id
       where r.user_id = ? and r.due_at <= ? and l.status = 'ready' order by r.due_at limit ?`,
      userId,
      Date.now(),
      limit,
    )
    .map((r) => r.lesson_id);
}

export function dueCount(userId: string): number {
  return (
    q.get<{ n: number }>(
      `select count(*) as n from reviews r join lessons l on l.id = r.lesson_id
       where r.user_id = ? and r.due_at <= ? and l.status = 'ready'`,
      userId,
      Date.now(),
    )?.n ?? 0
  );
}

export function nextDueAt(userId: string): number | null {
  return (
    q.get<{ due_at: number }>(
      `select r.due_at from reviews r join lessons l on l.id = r.lesson_id
       where r.user_id = ? and r.due_at > ? and l.status = 'ready' order by r.due_at limit 1`,
      userId,
      Date.now(),
    )?.due_at ?? null
  );
}
