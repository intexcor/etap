// Эмбеддинги через OpenAI-совместимый /v1/embeddings (llama-server --embedding с Qwen3-Embedding).
// Недоступность сервера — не ошибка: RAG деградирует до лексического поиска.
import { EMBED_MODEL, EMBED_URL } from "./config";
import { log } from "./log";

const BATCH = 16;
let unavailableUntil = 0;

/** Qwen3-Embedding: запрос с инструкцией, документы — как есть. */
export const queryText = (q: string) => `Instruct: Given a question, retrieve passages that answer it\nQuery: ${q}`;

export async function embed(texts: string[]): Promise<Float32Array[] | null> {
  if (!texts.length) return [];
  if (Date.now() < unavailableUntil) return null;
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch(`${EMBED_URL}/v1/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
      });
    } catch {
      unavailableUntil = Date.now() + 30_000;
      log.warn({ url: EMBED_URL }, "embedding server unavailable — lexical retrieval");
      return null;
    }
    if (!res.ok) {
      log.warn({ status: res.status, body: (await res.text()).slice(0, 200) }, "embedding request failed");
      return null;
    }
    const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(normalize(Float32Array.from(d.embedding)));
  }
  return out;
}

function normalize(v: Float32Array): Float32Array {
  let s = 0;
  for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
