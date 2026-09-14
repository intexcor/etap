import { useQueryClient } from "@tanstack/react-query";
import { FileText, Upload, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import { Button, Card, ErrorBox, Input, Page, Select } from "../components/ui";

const ACCEPT = ".pdf,.txt,.md,.tex,.py,.js,.ts,.cpp,.c,.java,.go,.sql,.json,.csv";

export function NewCoursePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [lessons, setLessons] = useState("auto");
  const [voice, setVoice] = useState("female");
  const [visibility, setVisibility] = useState("private");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData();
    if (file) form.append("file", file);
    else form.append("text", text);
    if (title.trim()) form.append("title", title.trim());
    if (lessons !== "auto") form.append("lessons", lessons);
    form.append("voice", voice);
    form.append("visibility", visibility);
    try {
      const course = await api.createCourse(form);
      await qc.invalidateQueries({ queryKey: ["courses"] });
      navigate(`/c/${course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <Page title="Новый курс">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Card>
          <label
            onDragOver={(e) => (e.preventDefault(), setDragging(true))}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) setFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm transition ${dragging ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"}`}
          >
            <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <>
                <FileText className="text-accent" />
                <span className="font-semibold">{file.name}</span>
                <span className="text-xs text-muted">{(file.size / 1024).toFixed(0)} КБ</span>
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-text"
                  onClick={(e) => (e.preventDefault(), setFile(null))}
                >
                  <X size={12} /> убрать
                </button>
              </>
            ) : (
              <>
                <Upload className="text-muted" />
                <span className="font-semibold">PDF, TXT, Markdown или код</span>
                <span className="text-xs text-muted">перетащи файл сюда или нажми, до 32 МБ</span>
              </>
            )}
          </label>
          <div className="my-3 text-center text-xs text-muted">или</div>
          <textarea
            placeholder="Вставь текст материала: конспект, главу учебника, статью…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={!!file}
            rows={8}
            className="w-full resize-y rounded-xl border border-line bg-bg px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/60 focus:border-accent disabled:opacity-40"
          />
        </Card>

        <Card className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
            Название (необязательно)
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Придумает модель, если оставить пустым" maxLength={120} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Количество уроков
            <Select value={lessons} onChange={(e) => setLessons(e.target.value)}>
              <option value="auto">Авто — по объёму материала</option>
              {[3, 5, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Голос озвучки
            <Select value={voice} onChange={(e) => setVoice(e.target.value)}>
              <option value="female">Женский</option>
              <option value="male">Мужской</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
            Кто видит курс
            <Select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="private">Только я</option>
              <option value="link">Все, у кого есть ссылка</option>
              <option value="public">Все — курс попадёт в «Обзор»</option>
            </Select>
          </label>
        </Card>

        {error && <ErrorBox>{error}</ErrorBox>}
        <Button disabled={busy || (!file && text.trim().length < 40)} className="self-end">
          {busy ? "Отправляю…" : "Сгенерировать курс"}
        </Button>
      </form>
    </Page>
  );
}
