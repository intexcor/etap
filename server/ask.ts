// «Спросить материал»: RAG-ответ по чанкам курса с указанием страниц.
import Anthropic from "@anthropic-ai/sdk";
import type { AskResult } from "../shared/api";
import { LOCAL_JSON_MODE, LOCAL_LLM_URL, LOCAL_MODEL, MODEL, PROVIDER } from "./config";
import { LlmUnavailableError } from "./local";
import { searchChunks, type Hit } from "./rag";

const SYSTEM = `Ты помощник по учебному материалу. Отвечай на вопрос только по приведённым фрагментам материала, на языке вопроса.
Если в фрагментах нет ответа — так и скажи, не выдумывай. Отвечай кратко (до 120 слов), по делу; после утверждений ставь ссылку на страницу в виде [стр. N].`;

let client: Anthropic | null = null;

export async function askMaterial(courseId: string, question: string): Promise<AskResult> {
  const hits = await searchChunks(courseId, question, 6);
  const sources = hits.map((h) => ({ page: h.page, text: h.text, score: Math.round(h.score * 1000) / 1000 }));
  if (!hits.length) return { answer: "Материал ещё не проиндексирован — подожди, пока курс сгенерируется.", sources, mode: "extractive" };

  if (PROVIDER === "none") return { answer: extractiveAnswer(hits), sources, mode: "extractive" };

  const context = [...hits].sort((a, b) => a.position - b.position).map((h) => `[стр. ${h.page}] ${h.text}`).join("\n\n");
  const user = `Фрагменты материала:\n"""\n${context}\n"""\n\nВопрос: ${question}`;
  try {
    const answer = PROVIDER === "claude" ? await askClaude(user) : await askLocalPlain(user);
    return { answer: answer.trim(), sources, mode: "llm" };
  } catch (e) {
    if (e instanceof LlmUnavailableError) return { answer: extractiveAnswer(hits), sources, mode: "extractive" };
    throw e;
  }
}

function extractiveAnswer(hits: Hit[]): string {
  return hits
    .slice(0, 3)
    .map((h) => `[стр. ${h.page}] ${h.text.slice(0, 300)}${h.text.length > 300 ? "…" : ""}`)
    .join("\n\n");
}

async function askClaude(user: string): Promise<string> {
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") throw new Error("Модель отказалась отвечать");
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function askLocalPlain(user: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        temperature: 0.3,
        max_tokens: 600,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw new LlmUnavailableError(`Локальная модель недоступна на ${LOCAL_LLM_URL}`);
  }
  if (!res.ok) throw new Error(`LLM-сервер ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string | null } }[] };
  void LOCAL_JSON_MODE;
  return data.choices[0]?.message.content ?? "";
}
