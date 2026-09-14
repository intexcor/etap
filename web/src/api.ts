import type { AnswerResult, AppConfig, CourseDetail, CourseSummary, Feed, LessonSummary, ReviewFeed, Stats, User } from "../../shared/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  if (!res.ok) {
    let message = res.statusText || `Ошибка ${res.status}`;
    try {
      message = (await res.json()).error ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { "content-type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  config: () => request<AppConfig>("/api/config"),
  me: () => request<User | null>("/api/me"),
  register: (body: { email: string; name: string; password: string }) => request<User>("/api/auth/register", json("POST", body)),
  login: (body: { email: string; password: string }) => request<User>("/api/auth/login", json("POST", body)),
  logout: () => request<{ ok: true }>("/api/auth/logout", json("POST")),
  updateMe: (body: { name: string }) => request<User>("/api/me", json("PATCH", body)),
  stats: () => request<Stats>("/api/me/stats"),

  courses: () => request<CourseSummary[]>("/api/courses"),
  explore: () => request<CourseSummary[]>("/api/explore"),
  course: (id: string) => request<CourseDetail>(`/api/courses/${id}`),
  createCourse: (form: FormData) => request<CourseSummary>("/api/courses", { method: "POST", body: form }),
  updateCourse: (id: string, body: { title?: string; visibility?: CourseSummary["visibility"] }) =>
    request<CourseSummary>(`/api/courses/${id}`, json("PATCH", body)),
  deleteCourse: (id: string) => request<{ ok: true }>(`/api/courses/${id}`, json("DELETE")),
  retryCourse: (id: string) => request<CourseSummary>(`/api/courses/${id}/retry`, json("POST")),
  feed: (id: string) => request<Feed>(`/api/courses/${id}/feed`),

  progress: (lessonId: string, body: { completed?: boolean; watched?: boolean }) =>
    request<NonNullable<LessonSummary["progress"]>>(`/api/lessons/${lessonId}/progress`, json("POST", body)),
  answer: (lessonId: string, body: { quizIndex: number; picked: number }) =>
    request<AnswerResult>(`/api/lessons/${lessonId}/answer`, json("POST", body)),
  render: (lessonId: string) => request<LessonSummary>(`/api/lessons/${lessonId}/render`, json("POST")),
  mp4Url: (lessonId: string) => `/api/lessons/${lessonId}/mp4`,
  review: () => request<ReviewFeed>("/api/review"),
};
