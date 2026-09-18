// «Спросить материал»: RAG-ответ по тексту курса со ссылками на страницы.
import { MessageCircleQuestion, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { AskResult } from "../../../shared/api";
import { api } from "../api";
import { Rich } from "../../../remotion/scenes";
import { Card, ErrorBox, Input, Spinner } from "./ui";

type Entry = { question: string; result?: AskResult; error?: string };

export function AskPanel({ courseId, canAsk, pages }: { courseId: string; canAsk: boolean; pages: number }) {
  const [question, setQuestion] = useState("");
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setQuestion("");
    setBusy(true);
    setLog((l) => [...l, { question: q }]);
    try {
      const result = await api.ask(courseId, q);
      setLog((l) => l.map((en, i) => (i === l.length - 1 ? { ...en, result } : en)));
    } catch (err) {
      setLog((l) => l.map((en, i) => (i === l.length - 1 ? { ...en, error: err instanceof Error ? err.message : String(err) } : en)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6">
      <div className="mb-3 flex items-center gap-2 font-bold">
        <MessageCircleQuestion size={18} className="text-accent" /> Спросить материал
        {pages > 0 && <span className="text-xs font-normal text-muted">· {pages} стр.</span>}
      </div>
      <div className="flex flex-col gap-3">
        {log.map((en, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="self-end rounded-2xl rounded-br-sm bg-accent/20 px-3.5 py-2 text-sm">{en.question}</div>
            {en.error && <ErrorBox>{en.error}</ErrorBox>}
            {!en.result && !en.error && <Spinner className="!h-5 !w-5 !border-2" />}
            {en.result && (
              <div className="rounded-2xl rounded-bl-sm border border-line bg-bg px-3.5 py-2.5 text-sm leading-relaxed">
                <div className="whitespace-pre-wrap">
                  <Rich text={en.result.answer} />
                </div>
                {en.result.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {en.result.sources.map((s, k) => (
                      <button
                        key={k}
                        onClick={() => setOpen(open === i * 100 + k ? null : i * 100 + k)}
                        className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:text-text"
                        title={`Релевантность ${s.score}`}
                      >
                        стр. {s.page}
                      </button>
                    ))}
                  </div>
                )}
                {en.result.sources.map(
                  (s, k) =>
                    open === i * 100 + k && (
                      <blockquote key={k} className="mt-2 border-l-2 border-accent pl-3 text-xs text-muted">
                        {s.text}
                      </blockquote>
                    ),
                )}
                {en.result.mode === "extractive" && <div className="mt-2 text-[11px] text-muted">Модель недоступна — показаны фрагменты материала.</div>}
              </div>
            )}
          </div>
        ))}
        {canAsk ? (
          <form onSubmit={submit} className="flex gap-2">
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Например: чем норма отличается от длины?" maxLength={500} />
            <button disabled={busy || question.trim().length < 3} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-white disabled:opacity-40">
              <Send size={16} />
            </button>
          </form>
        ) : (
          <p className="text-xs text-muted">
            <Link to="/login" className="text-accent">
              Войди
            </Link>
            , чтобы задавать вопросы по материалу.
          </p>
        )}
      </div>
    </Card>
  );
}
