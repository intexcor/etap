// DTO между сервером и клиентом.
import type { LessonScene, Quiz, VoiceGender } from "./schema";

export type User = { id: string; email: string; name: string; createdAt: number };

export type Visibility = "private" | "link" | "public";
export type CourseStatus = "queued" | "indexing" | "outlining" | "generating" | "ready" | "error";
export type LessonStatus = "pending" | "ready" | "error";
export type Mp4Status = "queued" | "rendering" | "done" | "error";

export type LessonSummary = {
  id: string;
  position: number;
  title: string;
  goal: string;
  status: LessonStatus;
  error: string | null;
  duration: number;
  quizCount: number;
  mp4: { status: Mp4Status; progress: number; error: string | null } | null;
  /** Только для авторизованного пользователя. */
  progress?: { completed: boolean; watched: number; correct: number; answered: number; dueAt: number | null };
};

export type CourseSummary = {
  id: string;
  title: string;
  sourceName: string;
  language: string | null;
  voice: VoiceGender;
  visibility: Visibility;
  status: CourseStatus;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  owner: { id: string; name: string };
  isOwner: boolean;
  lessonsTotal: number;
  lessonsReady: number;
  pages: number;
  /** Только для авторизованного пользователя. */
  progress?: { completed: number; correct: number; answered: number };
};

export type AskSource = { page: number; text: string; score: number };
export type AskResult = { answer: string; sources: AskSource[]; mode: "llm" | "extractive" };

export type CourseDetail = CourseSummary & { lessons: LessonSummary[] };

/** Квиз без правильного ответа — он приходит после ответа. */
export type ClientQuiz = { question: string; options: string[] };

export type QuizState = { picked: number; correct: boolean; correctIndex: number; explanation: string };

export type FeedLesson = {
  id: string;
  courseId: string;
  courseTitle: string;
  position: number;
  title: string;
  goal: string;
  sourceExcerpt: string;
  scenes: LessonScene[];
  quizzes: ClientQuiz[];
  duration: number;
  mp4: LessonSummary["mp4"];
  progress: { completed: boolean; watched: number; answers: Record<number, QuizState> };
};

export type Feed = { course: CourseSummary; lessons: FeedLesson[] };

export type ReviewFeed = { due: FeedLesson[]; dueCount: number; nextDueAt: number | null };

export type AnswerResult = QuizState & { review: { dueAt: number; intervalDays: number } | null };

export type Stats = {
  lessonsCompleted: number;
  answered: number;
  correct: number;
  coursesCreated: number;
  streakDays: number;
  dueToday: number;
  /** Последние 14 дней: активность по дням. */
  days: { date: string; lessons: number; answers: number }[];
};

export type AppConfig = { provider: "claude" | "local" | "ollama" | "none"; model: string; registrationOpen: boolean };

/** Полный квиз хранится только на сервере. */
export type StoredQuiz = Quiz;
