import type { Stats } from "../shared/api";
import { q } from "./db";
import { dueCount } from "./review";

const DAY = 24 * 3600 * 1000;
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

export function userStats(userId: string): Stats {
  const totals = q.get<{ completed: number; answered: number; correct: number; courses: number }>(
    `select
      (select count(*) from lesson_progress where user_id = ? and completed_at is not null) as completed,
      (select count(*) from quiz_answers where user_id = ?) as answered,
      (select count(*) from quiz_answers where user_id = ? and correct = 1) as correct,
      (select count(*) from courses where owner_id = ?) as courses`,
    userId,
    userId,
    userId,
    userId,
  )!;

  const since = Date.now() - 60 * DAY;
  const events = [
    ...q.all<{ ts: number }>("select completed_at as ts from lesson_progress where user_id = ? and completed_at > ?", userId, since).map((r) => ({ ts: r.ts, kind: "lesson" as const })),
    ...q.all<{ ts: number }>("select created_at as ts from quiz_answers where user_id = ? and created_at > ?", userId, since).map((r) => ({ ts: r.ts, kind: "answer" as const })),
  ];
  const byDay = new Map<string, { lessons: number; answers: number }>();
  for (const e of events) {
    const key = dayKey(e.ts);
    const d = byDay.get(key) ?? { lessons: 0, answers: 0 };
    if (e.kind === "lesson") d.lessons += 1;
    else d.answers += 1;
    byDay.set(key, d);
  }

  const days = Array.from({ length: 14 }, (_, i) => {
    const date = dayKey(Date.now() - (13 - i) * DAY);
    return { date, ...(byDay.get(date) ?? { lessons: 0, answers: 0 }) };
  });

  // Серия: подряд идущие дни с активностью, считая от сегодня (или от вчера, если сегодня ещё не занимался).
  let streak = 0;
  let cursor = Date.now();
  if (!byDay.has(dayKey(cursor))) cursor -= DAY;
  while (byDay.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }

  return {
    lessonsCompleted: totals.completed,
    answered: totals.answered,
    correct: totals.correct,
    coursesCreated: totals.courses,
    streakDays: streak,
    dueToday: dueCount(userId),
    days,
  };
}
