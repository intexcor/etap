import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { api } from "../api";
import { Button, ErrorBox, Input } from "../components/ui";
import { useConfig, useMe } from "../hooks";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const me = useMe();
  const config = useConfig();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (me.data) return <Navigate to={from} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = mode === "login" ? await api.login({ email: form.email, password: form.password }) : await api.register(form);
      qc.setQueryData(["me"], user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6">
        <div className="mb-1 text-2xl font-extrabold tracking-tight">
          <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-lg bg-accent align-middle text-sm text-white">E</span>ETAP
        </div>
        <p className="mb-6 text-sm text-muted">{mode === "login" ? "Войди, чтобы продолжить учиться" : "Создай аккаунт — прогресс и повторения будут сохраняться"}</p>
        <div className="flex flex-col gap-3">
          {mode === "register" && <Input placeholder="Имя" value={form.name} onChange={set("name")} required autoComplete="name" />}
          <Input type="email" placeholder="E-mail" value={form.email} onChange={set("email")} required autoComplete="email" />
          <Input
            type="password"
            placeholder={mode === "register" ? "Пароль (от 8 символов)" : "Пароль"}
            value={form.password}
            onChange={set("password")}
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
          <Button disabled={busy} className="mt-1 w-full">
            {busy ? "Секунду…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </Button>
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          {mode === "login" ? (
            config.data?.registrationOpen !== false && (
              <>
                Нет аккаунта?{" "}
                <Link to="/register" state={{ from }} className="text-accent">
                  Зарегистрироваться
                </Link>
              </>
            )
          ) : (
            <>
              Уже есть аккаунт?{" "}
              <Link to="/login" state={{ from }} className="text-accent">
                Войти
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
