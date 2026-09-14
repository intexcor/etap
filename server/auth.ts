import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parseCookie, stringifySetCookie } from "cookie";
import type { Request, RequestHandler, Response } from "express";
import { nanoid } from "nanoid";
import type { User } from "../shared/api";
import { PUBLIC_URL } from "./config";
import { q } from "./db";
import { HttpError } from "./errors";

const COOKIE = "learntok_session";
const SESSION_TTL = 30 * 24 * 3600 * 1000;
const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: SCRYPT_N }).toString("hex");
  return `scrypt$${SCRYPT_N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, n, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64, { N: Number(n) });
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

type UserRow = { id: string; email: string; name: string; created_at: number };
export const toUser = (r: UserRow): User => ({ id: r.id, email: r.email, name: r.name, createdAt: r.created_at });

export function createSession(res: Response, userId: string) {
  const token = nanoid(32);
  const now = Date.now();
  q.run("insert into sessions (token, user_id, created_at, expires_at) values (?, ?, ?, ?)", token, userId, now, now + SESSION_TTL);
  res.setHeader(
    "set-cookie",
    stringifySetCookie({
      name: COOKIE,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: PUBLIC_URL.startsWith("https://"),
      path: "/",
      maxAge: SESSION_TTL / 1000,
    }),
  );
}

export function destroySession(req: Request, res: Response) {
  const token = readToken(req);
  if (token) q.run("delete from sessions where token = ?", token);
  res.setHeader("set-cookie", stringifySetCookie({ name: COOKIE, value: "", path: "/", maxAge: 0 }));
}

function readToken(req: Request): string | null {
  return parseCookie(req.headers.cookie ?? "")[COOKIE] ?? null;
}

/** Кладёт req.user, если сессия валидна; не требует входа. */
export const attachUser: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (token) {
    const row = q.get<UserRow>(
      `select u.id, u.email, u.name, u.created_at from sessions s join users u on u.id = s.user_id
       where s.token = ? and s.expires_at > ?`,
      token,
      Date.now(),
    );
    if (row) req.user = toUser(row);
  }
  next();
};

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, "Нужно войти"));
  next();
};

// Простая защита от перебора паролей: по e-mail, в памяти процесса.
const attempts = new Map<string, { count: number; until: number }>();
export function checkLoginAttempts(email: string) {
  const a = attempts.get(email);
  if (a && a.count >= 8 && a.until > Date.now()) throw new HttpError(429, "Слишком много попыток, подожди 10 минут");
}
export function recordLoginAttempt(email: string, success: boolean) {
  if (success) return void attempts.delete(email);
  const a = attempts.get(email) ?? { count: 0, until: 0 };
  a.count += 1;
  a.until = Date.now() + 10 * 60 * 1000;
  attempts.set(email, a);
}

export function purgeExpiredSessions() {
  q.run("delete from sessions where expires_at < ?", Date.now());
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
