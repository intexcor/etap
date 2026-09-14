import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { checkLoginAttempts, createSession, destroySession, hashPassword, recordLoginAttempt, requireUser, toUser, verifyPassword } from "../auth";
import { REGISTRATION_OPEN } from "../config";
import { q } from "../db";
import { HttpError, badRequest, parseBody } from "../errors";
import { userStats } from "../stats";

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email("Некорректный e-mail").max(200);
const password = z.string().min(8, "Пароль — минимум 8 символов").max(200);
const name = z.string().trim().min(1, "Как тебя зовут?").max(60);

type UserRow = { id: string; email: string; name: string; password_hash: string; created_at: number };

authRouter.post("/auth/register", (req, res) => {
  if (!REGISTRATION_OPEN) throw new HttpError(403, "Регистрация закрыта");
  const body = parseBody(z.object({ email, password, name }), req.body);
  if (q.get("select 1 from users where email = ?", body.email)) throw badRequest("Такой e-mail уже зарегистрирован");
  const id = nanoid(10);
  q.run("insert into users (id, email, name, password_hash, created_at) values (?, ?, ?, ?, ?)", id, body.email, body.name, hashPassword(body.password), Date.now());
  createSession(res, id);
  res.json(toUser({ id, email: body.email, name: body.name, created_at: Date.now() }));
});

authRouter.post("/auth/login", (req, res) => {
  const body = parseBody(z.object({ email, password: z.string().min(1) }), req.body);
  checkLoginAttempts(body.email);
  const user = q.get<UserRow>("select * from users where email = ?", body.email);
  const ok = !!user && verifyPassword(body.password, user.password_hash);
  recordLoginAttempt(body.email, ok);
  if (!user || !ok) throw new HttpError(401, "Неверный e-mail или пароль");
  createSession(res, user.id);
  res.json(toUser(user));
});

authRouter.post("/auth/logout", (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  res.json(req.user ?? null);
});

authRouter.patch("/me", requireUser, (req, res) => {
  const body = parseBody(z.object({ name }), req.body);
  q.run("update users set name = ? where id = ?", body.name, req.user!.id);
  res.json({ ...req.user!, name: body.name });
});

authRouter.get("/me/stats", requireUser, (req, res) => {
  res.json(userStats(req.user!.id));
});
