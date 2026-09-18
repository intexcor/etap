// Работа с материалом без LLM (из прототипа ETAP): лексический retrieval релевантных
// фрагментов и extractive-выжимка в сценарий. Используется как fallback, когда модель
// недоступна, и как provider=none для проверки пайплайна без ключей.
import type { LessonDraft, Outline, Scene } from "../shared/schema";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Предложения длиннее 35 символов, в порядке текста. */
export function sentences(text: string): string[] {
  return (text.match(/[^.!?\n]+[.!?]+/g) || []).map(clean).filter((s) => s.length > 35);
}

const terms = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);

/**
 * Выбирает из материала куски, лексически ближайшие к запросу, в пределах maxChars.
 * Куски — окна по 6 предложений с шагом 5, порядок в результате исходный.
 */
export function retrieve(text: string, query: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const source = sentences(text);
  const chunks: { index: number; chunk: string }[] = [];
  for (let i = 0; i < source.length; i += 5) chunks.push({ index: i, chunk: source.slice(i, i + 6).join(" ") });
  const q = terms(query);
  const scored = chunks
    .map((c) => {
      const lower = c.chunk.toLowerCase();
      return { ...c, score: [...q].reduce((sum, t) => sum + (lower.includes(t) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const picked: typeof scored = [];
  let size = 0;
  for (const c of scored) {
    if (size + c.chunk.length > maxChars) continue;
    picked.push(c);
    size += c.chunk.length;
    if (size > maxChars * 0.9) break;
  }
  const joined = picked.sort((a, b) => a.index - b.index).map((c) => c.chunk).join("\n\n");
  return joined || text.slice(0, maxChars);
}

/** Абзацы-заголовки: короткая строка без знака препинания в конце, минимум два слова. */
function isHeading(paragraph: string) {
  const p = paragraph.trim();
  return p.length >= 10 && p.length <= 80 && !p.includes("\n") && !/[.!?:;,]$/.test(p) && p.split(/\s+/).length >= 2;
}

type Segment = { heading: string | null; body: string };

/** Делит материал на n последовательных частей примерно равного объёма; заголовки внутри части — кандидаты в название. */
function segments(text: string, n: number): Segment[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const total = paragraphs.reduce((s, p) => s + p.length, 0);
  const out: Segment[] = [];
  let current: { heading: string | null; parts: string[]; size: number } = { heading: null, parts: [], size: 0 };
  for (const p of paragraphs) {
    if (isHeading(p)) {
      if (!current.heading || current.size === 0) current.heading = p;
      continue;
    }
    current.parts.push(p);
    current.size += p.length;
    if (current.size >= total / n && out.length < n - 1) {
      out.push({ heading: current.heading, body: current.parts.join("\n\n") });
      current = { heading: null, parts: [], size: 0 };
    }
  }
  if (current.parts.length) out.push({ heading: current.heading, body: current.parts.join("\n\n") });
  return out.filter((s) => sentences(s.body).length > 0);
}

const lessonsCount = (text: string, lessons: number | "auto") =>
  lessons === "auto" ? Math.min(5, Math.max(3, Math.round(text.length / 4000))) : lessons;

export function extractiveOutline(text: string, name: string, lessons: number | "auto"): Outline {
  const parts = segments(text, lessonsCount(text, lessons));
  const concepts: Outline["concepts"] = parts.map((seg, i) => {
    const first = sentences(seg.body)[0] ?? seg.body.slice(0, 120);
    const title = seg.heading ?? `${first.split(/\s+/).slice(0, 7).join(" ").replace(/[,:;—-]+$/, "")}…`;
    return { title: title || `Часть ${i + 1}`, goal: `Понять: ${first.slice(0, 120)}`, sourceExcerpt: first.slice(0, 300) };
  });
  return {
    courseTitle: name.replace(/[-_]/g, " ").replace(/\.(pdf|txt|md)$/i, "").replace(/\s+\w{8}$/, ""),
    language: /[а-яё]/i.test(text) ? "ru-RU" : "en-US",
    concepts,
  };
}

/** Урок из своей части материала: зацепка — первое предложение, три ключевые идеи по ходу текста, вывод — последнее. */
export function extractiveLesson(text: string, outline: Outline, index: number): LessonDraft {
  const concept = outline.concepts[index];
  const seg = segments(text, outline.concepts.length)[index];
  const source = seg ? sentences(seg.body) : sentences(retrieve(text, concept.title, 2500));
  const at = (k: number) => source[Math.min(source.length - 1, Math.round(k * (source.length - 1)))] ?? concept.title;
  const hook = source[0] ?? concept.title;
  const points = [...new Set([at(0.3), at(0.55), at(0.8)])].filter((s) => s !== hook).slice(0, 3);
  const takeaway = source.length > 1 ? source[source.length - 1] : hook;
  const scenes: Scene[] = [
    { type: "hook", emoji: "📘", text: concept.title.slice(0, 70), narration: hook },
    ...points.map((p, i): Scene => ({ type: "keypoint", number: i + 1, text: p.slice(0, 160), narration: p })),
    { type: "summary", text: takeaway.slice(0, 150), narration: `Главное: ${takeaway}` },
  ];
  return { title: concept.title, scenes, quizzes: [] };
}
