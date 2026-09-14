import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, type z } from "zod";
import { log } from "./log";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Не найдено") => new HttpError(404, what);
export const forbidden = (what = "Нет доступа") => new HttpError(403, what);
export const badRequest = (what: string) => new HttpError(400, what);

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Неверный запрос");
  }
  return result.data;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) return void res.status(400).json({ error: err.issues[0]?.message ?? "Неверный запрос" });
  if (err?.type === "entity.too.large" || err?.code === "LIMIT_FILE_SIZE") {
    return void res.status(413).json({ error: "Файл слишком большой (максимум 32 МБ)" });
  }
  log.error({ err }, "unhandled");
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Не найдено" });
};
