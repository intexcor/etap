// Запросы к БД и сборка DTO.
import type {
  CourseDetail,
  CourseStatus,
  CourseSummary,
  FeedLesson,
  LessonStatus,
  LessonSummary,
  Mp4Status,
  QuizState,
  Visibility,
} from "../shared/api";
import type { LessonScene, Quiz, VoiceGender } from "../shared/schema";
import { q } from "./db";
import { forbidden, notFound } from "./errors";

export type CourseRow = {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  source_name: string;
  source_path: string | null;
  language: string | null;
  voice: VoiceGender;
  visibility: Visibility;
  status: CourseStatus;
  error: string | null;
  created_at: number;
  updated_at: number;
  lessons_total: number;
  lessons_ready: number;
  pages: number;
};

export type LessonRow = {
  id: string;
  course_id: string;
  position: number;
  title: string;
  goal: string;
  source_excerpt: string;
  status: LessonStatus;
  error: string | null;
  scenes_json: string;
  quizzes_json: string;
  duration: number;
  mp4_status: Mp4Status | null;
  mp4_progress: number;
  mp4_error: string | null;
};

const COURSE_SELECT = `
  select c.*, u.name as owner_name,
    (select count(*) from lessons l where l.course_id = c.id) as lessons_total,
    (select count(*) from lessons l where l.course_id = c.id and l.status = 'ready') as lessons_ready
  from courses c join users u on u.id = c.owner_id`;

export function getCourseRow(id: string): CourseRow | undefined {
  return q.get<CourseRow>(`${COURSE_SELECT} where c.id = ?`, id);
}

export function canView(course: Pick<CourseRow, "owner_id" | "visibility">, userId: string | undefined) {
  return course.visibility !== "private" || course.owner_id === userId;
}

export function requireCourse(id: string, userId: string | undefined, { owner = false } = {}): CourseRow {
  const course = getCourseRow(id);
  if (!course || !canView(course, userId)) throw notFound("Курс не найден");
  if (owner && course.owner_id !== userId) throw forbidden("Только автор курса может это сделать");
  return course;
}

export function listOwnCourses(userId: string): CourseRow[] {
  return q.all<CourseRow>(`${COURSE_SELECT} where c.owner_id = ? order by c.created_at desc`, userId);
}

export function listPublicCourses(limit = 50): CourseRow[] {
  return q.all<CourseRow>(
    `${COURSE_SELECT} where c.visibility = 'public' and c.status in ('ready', 'generating') order by c.created_at desc limit ?`,
    limit,
  );
}

type ProgressAgg = { completed: number; correct: number; answered: number };

function courseProgress(courseId: string, userId: string): ProgressAgg {
  const row = q.get<{ completed: number; correct: number; answered: number }>(
    `select
      (select count(*) from lesson_progress p join lessons l on l.id = p.lesson_id
        where l.course_id = ? and p.user_id = ? and p.completed_at is not null) as completed,
      (select count(*) from quiz_answers a join lessons l on l.id = a.lesson_id
        where l.course_id = ? and a.user_id = ? and a.correct = 1) as correct,
      (select count(*) from quiz_answers a join lessons l on l.id = a.lesson_id
        where l.course_id = ? and a.user_id = ?) as answered`,
    courseId,
    userId,
    courseId,
    userId,
    courseId,
    userId,
  );
  return row ?? { completed: 0, correct: 0, answered: 0 };
}

export function toCourseSummary(c: CourseRow, userId?: string): CourseSummary {
  return {
    id: c.id,
    title: c.title,
    sourceName: c.source_name,
    language: c.language,
    voice: c.voice,
    visibility: c.visibility,
    status: c.status,
    error: c.error,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    owner: { id: c.owner_id, name: c.owner_name },
    isOwner: c.owner_id === userId,
    lessonsTotal: c.lessons_total,
    lessonsReady: c.lessons_ready,
    pages: c.pages,
    progress: userId ? courseProgress(c.id, userId) : undefined,
  };
}

export function listLessonRows(courseId: string): LessonRow[] {
  return q.all<LessonRow>("select * from lessons where course_id = ? order by position", courseId);
}

export function getLessonRow(id: string): LessonRow | undefined {
  return q.get<LessonRow>("select * from lessons where id = ?", id);
}

export function requireLesson(id: string, userId: string | undefined, opts?: { owner?: boolean }) {
  const lesson = getLessonRow(id);
  if (!lesson) throw notFound("Урок не найден");
  const course = requireCourse(lesson.course_id, userId, opts);
  return { lesson, course };
}

export const mp4Of = (l: LessonRow): LessonSummary["mp4"] =>
  l.mp4_status ? { status: l.mp4_status, progress: l.mp4_progress, error: l.mp4_error } : null;

type LessonUserState = {
  completed: boolean;
  watched: number;
  answers: Record<number, QuizState>;
  dueAt: number | null;
};

function lessonUserState(lesson: LessonRow, userId: string): LessonUserState {
  const progress = q.get<{ watched: number; completed_at: number | null }>(
    "select watched, completed_at from lesson_progress where user_id = ? and lesson_id = ?",
    userId,
    lesson.id,
  );
  const review = q.get<{ due_at: number }>("select due_at from reviews where user_id = ? and lesson_id = ?", userId, lesson.id);
  // Первый ответ на каждый квиз — он и считается.
  const rows = q.all<{ quiz_index: number; picked: number; correct: number }>(
    `select quiz_index, picked, correct from quiz_answers where user_id = ? and lesson_id = ?
     group by quiz_index having min(id)`,
    userId,
    lesson.id,
  );
  const quizzes = JSON.parse(lesson.quizzes_json) as Quiz[];
  const answers: Record<number, QuizState> = {};
  for (const r of rows) {
    const quiz = quizzes[r.quiz_index];
    if (!quiz) continue;
    answers[r.quiz_index] = {
      picked: r.picked,
      correct: r.correct === 1,
      correctIndex: quiz.correctIndex,
      explanation: quiz.explanation,
    };
  }
  return { completed: !!progress?.completed_at, watched: progress?.watched ?? 0, answers, dueAt: review?.due_at ?? null };
}

export function toLessonSummary(l: LessonRow, userId?: string): LessonSummary {
  const quizzes = JSON.parse(l.quizzes_json) as Quiz[];
  const base: LessonSummary = {
    id: l.id,
    position: l.position,
    title: l.title,
    goal: l.goal,
    status: l.status,
    error: l.error,
    duration: l.duration,
    quizCount: quizzes.length,
    mp4: mp4Of(l),
  };
  if (userId) {
    const s = lessonUserState(l, userId);
    const answered = Object.values(s.answers);
    base.progress = {
      completed: s.completed,
      watched: s.watched,
      correct: answered.filter((a) => a.correct).length,
      answered: answered.length,
      dueAt: s.dueAt,
    };
  }
  return base;
}

export function toCourseDetail(c: CourseRow, userId?: string): CourseDetail {
  return { ...toCourseSummary(c, userId), lessons: listLessonRows(c.id).map((l) => toLessonSummary(l, userId)) };
}

export function toFeedLesson(l: LessonRow, course: Pick<CourseRow, "id" | "title">, userId?: string): FeedLesson {
  const scenes = JSON.parse(l.scenes_json) as LessonScene[];
  const quizzes = JSON.parse(l.quizzes_json) as Quiz[];
  const state = userId ? lessonUserState(l, userId) : { completed: false, watched: 0, answers: {}, dueAt: null };
  return {
    id: l.id,
    courseId: course.id,
    courseTitle: course.title,
    position: l.position,
    title: l.title,
    goal: l.goal,
    sourceExcerpt: l.source_excerpt,
    scenes: scenes.map((s) => (s.audio ? { ...s, audio: { ...s.audio, src: `/media/${course.id}/${s.audio.src}` } } : s)),
    quizzes: quizzes.map((qz) => ({ question: qz.question, options: qz.options })),
    duration: l.duration,
    mp4: mp4Of(l),
    progress: { completed: state.completed, watched: state.watched, answers: state.answers },
  };
}
