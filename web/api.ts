import type { Course, CourseSummary } from "../shared/schema";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).error ?? message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  config: () => fetch("/api/config").then((r) => json<{ provider: "claude" | "local"; model: string }>(r)),
  courses: () => fetch("/api/courses").then((r) => json<CourseSummary[]>(r)),
  course: (id: string) => fetch(`/api/courses/${id}`).then((r) => json<Course>(r)),
  create: (form: FormData) => fetch("/api/courses", { method: "POST", body: form }).then((r) => json<{ id: string }>(r)),
  render: (id: string, lessonId: string) =>
    fetch(`/api/courses/${id}/lessons/${lessonId}/render`, { method: "POST" }).then((r) => json<{ ok: true }>(r)),
  mp4Url: (id: string, lessonId: string) => `/api/courses/${id}/lessons/${lessonId}/mp4`,
};
