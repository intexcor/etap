import React, { useEffect, useState } from "react";
import type { CourseSummary } from "../shared/schema";
import { api } from "./api";

const STATUS: Record<CourseSummary["status"], string> = {
  outlining: "Разбираю материал на темы…",
  generating: "Генерирую уроки",
  ready: "Готово",
  error: "Ошибка",
};

export function Home() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [lessons, setLessons] = useState("auto");
  const [voice, setVoice] = useState("female");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<{ provider: string; model: string } | null>(null);

  useEffect(() => void api.config().then(setConfig, () => {}), []);

  useEffect(() => {
    const load = () => api.courses().then(setCourses, () => {});
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData();
    if (file) form.append("file", file);
    else form.append("text", text);
    form.append("lessons", lessons);
    form.append("voice", voice);
    try {
      const { id } = await api.create(form);
      location.hash = `#/c/${id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="brand">
        Learn<span>Tok</span>
      </div>
      <p className="lead">Загрузи конспект, лекцию или главу учебника — получишь ленту коротких роликов с озвучкой и квизами.</p>
      {config?.provider === "local" && (
        <p className="notice">
          Мок-режим: сценарии пишет локальная {config.model}. Качество низкое, материал обрезается до ~8000 символов.
        </p>
      )}

      <form className="card" onSubmit={submit}>
        <textarea
          placeholder="Вставь текст материала…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!file}
        />
        <div className="row">
          <label className="file">
            <input
              type="file"
              accept=".pdf,.txt,.md,.tex,.py,.js,.ts,.cpp,.c,.java,.go,.sql,.json,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? `📄 ${file.name}` : "📎 или PDF / TXT / MD"}
          </label>
          {file && (
            <button type="button" className="ghost" onClick={() => setFile(null)}>
              ✕
            </button>
          )}
        </div>
        <div className="row">
          <select value={lessons} onChange={(e) => setLessons(e.target.value)}>
            <option value="auto">Уроков: авто</option>
            {[3, 5, 8, 12].map((n) => (
              <option key={n} value={n}>
                Уроков: {n}
              </option>
            ))}
          </select>
          <select value={voice} onChange={(e) => setVoice(e.target.value)}>
            <option value="female">Голос: женский</option>
            <option value="male">Голос: мужской</option>
          </select>
          <button className="primary" disabled={busy || (!file && !text.trim())}>
            {busy ? "Отправляю…" : "Сгенерировать"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>

      {courses.length > 0 && (
        <section className="courses">
          {courses.map((c) => (
            <a key={c.id} className="card course" href={`#/c/${c.id}`}>
              <div style={{ minWidth: 0 }}>
                <div className="course-title">{c.title}</div>
                <div className="status">
                  {c.status === "error" && c.error ? c.error : STATUS[c.status]}
                  {c.total > 0 && c.status !== "error" && ` · ${c.done}/${c.total}`}
                </div>
                {(c.status === "generating" || c.status === "outlining") && (
                  <div className="bar">
                    <i style={{ width: `${c.total ? (c.done / c.total) * 100 : 5}%` }} />
                  </div>
                )}
              </div>
              <span className="go">▶</span>
            </a>
          ))}
        </section>
      )}
    </main>
  );
}
