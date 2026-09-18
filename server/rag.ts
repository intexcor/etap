// RAG по материалу курса: страницы → чанки → эмбеддинги в SQLite → семантический поиск
// (косинус по нормированным векторам; для сотен чанков на курс перебор в JS быстрее любого индекса).
// Без эмбеддинг-сервера — лексический поиск по тем же чанкам.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { q, transaction } from "./db";
import { dot, embed, queryText } from "./embed";
import type { Material } from "./generate";
import { log } from "./log";

export type Chunk = { id: number; position: number; page: number; text: string };
export type Hit = Chunk & { score: number };

const CHUNK_TARGET = 700;
const CHUNK_MAX = 1100;

/** Текст материала постранично (PDF через pdftotext, страницы разделены \f). */
export async function extractPages(material: Material): Promise<string[]> {
  let raw: string;
  if (material.kind === "text") {
    raw = material.text;
  } else {
    const file = path.join(os.tmpdir(), `learntok-${process.pid}-${Date.now()}.pdf`);
    fs.writeFileSync(file, Buffer.from(material.base64, "base64"));
    try {
      raw = await new Promise<string>((resolve, reject) =>
        execFile("pdftotext", ["-enc", "UTF-8", file, "-"], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) =>
          err ? reject(new Error(`pdftotext: ${err.message}`)) : resolve(stdout),
        ),
      );
    } finally {
      fs.rmSync(file, { force: true });
    }
  }
  const pages = raw
    .split("\f")
    .map((p) => p.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean);
  if (!pages.length) throw new Error("В материале не нашлось текста (скан PDF без текстового слоя?)");
  return pages;
}

/** Режет страницы на чанки по абзацам и предложениям, ~700 символов, с перекрытием в одно предложение. */
export function chunkPages(pages: string[]): Omit<Chunk, "id">[] {
  const chunks: Omit<Chunk, "id">[] = [];
  let carry = "";
  pages.forEach((page, pi) => {
    const units = page
      .split(/\n{2,}/)
      .flatMap((p) => (p.length > CHUNK_MAX ? (p.match(/[^.!?]+[.!?]+|\S+$/g) ?? [p]) : [p]))
      .map((u) => u.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    let current = carry;
    for (const u of units) {
      if (current && current.length + u.length > CHUNK_TARGET) {
        chunks.push({ position: chunks.length, page: pi + 1, text: current.trim() });
        const lastSentence = current.match(/[^.!?]+[.!?]+\s*$/)?.[0] ?? "";
        current = lastSentence.length < 200 ? `${lastSentence} ${u}` : u;
      } else {
        current = current ? `${current} ${u}` : u;
      }
    }
    carry = current;
  });
  if (carry.trim()) chunks.push({ position: chunks.length, page: pages.length, text: carry.trim() });
  return chunks;
}

export function isIndexed(courseId: string): boolean {
  return (q.get<{ n: number }>("select count(*) as n from chunks where course_id = ?", courseId)?.n ?? 0) > 0;
}

export async function indexCourse(courseId: string, material: Material): Promise<{ chunks: number; pages: number; embedded: boolean }> {
  const pages = await extractPages(material);
  const chunks = chunkPages(pages);
  const vectors = await embed(chunks.map((c) => c.text));
  transaction(() => {
    q.run("delete from chunks where course_id = ?", courseId);
    chunks.forEach((c, i) => {
      const v = vectors?.[i];
      q.run(
        "insert into chunks (course_id, position, page, text, embedding) values (?, ?, ?, ?, ?)",
        courseId,
        c.position,
        c.page,
        c.text,
        v ? Buffer.from(v.buffer, v.byteOffset, v.byteLength) : null,
      );
    });
    q.run("update courses set pages = ?, chunk_count = ?, indexed_at = ? where id = ?", pages.length, chunks.length, Date.now(), courseId);
  });
  log.info({ courseId, pages: pages.length, chunks: chunks.length, embedded: !!vectors }, "course indexed");
  return { chunks: chunks.length, pages: pages.length, embedded: !!vectors };
}

export function fullText(courseId: string): string {
  return q
    .all<{ text: string }>("select text from chunks where course_id = ? order by position", courseId)
    .map((r) => r.text)
    .join("\n\n");
}

const terms = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);

export async function searchChunks(courseId: string, query: string, k = 6): Promise<Hit[]> {
  const rows = q.all<Chunk & { embedding: Uint8Array | null }>(
    "select id, position, page, text, embedding from chunks where course_id = ? order by position",
    courseId,
  );
  if (!rows.length) return [];
  const withVectors = rows.filter((r) => r.embedding);
  const [qv] = withVectors.length ? ((await embed([queryText(query)])) ?? []) : [];
  let scored: Hit[];
  if (qv) {
    scored = rows.map((r) => ({
      id: r.id,
      position: r.position,
      page: r.page,
      text: r.text,
      score: r.embedding ? dot(qv, new Float32Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 4)) : 0,
    }));
  } else {
    const t = terms(query);
    scored = rows.map((r) => {
      const lower = r.text.toLowerCase();
      const hits = [...t].filter((w) => lower.includes(w)).length;
      return { id: r.id, position: r.position, page: r.page, text: r.text, score: t.size ? hits / t.size : 0 };
    });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

/** Контекст для LLM: лучшие чанки в порядке документа с пометкой страницы, в пределах maxChars. */
export async function contextFor(courseId: string, query: string, maxChars: number): Promise<{ text: string; hits: Hit[] } | null> {
  if (!isIndexed(courseId)) return null;
  const hits = await searchChunks(courseId, query, 12);
  const picked: Hit[] = [];
  let size = 0;
  for (const h of hits) {
    if (size + h.text.length > maxChars) continue;
    picked.push(h);
    size += h.text.length;
  }
  picked.sort((a, b) => a.position - b.position);
  return { text: picked.map((h) => `[стр. ${h.page}] ${h.text}`).join("\n\n"), hits: picked };
}
