// Локальная модель (Qwen3-4B в vllm-mlx или Qwen3-0.6B в llama-server) вместо Claude — мок, пока нет ключа.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { LOCAL_JSON_MODE, LOCAL_LLM_URL, LOCAL_MAX_CHARS, LOCAL_MODEL } from "./config";
import { retrieve } from "./extractive";
import type { Material } from "./generate";

export class LlmUnavailableError extends Error {}

// Грамматика llama.cpp по этим лимитам не даёт маленькой модели зациклиться
// на бесконечном массиве или строке.
const ARRAY_LIMITS: Record<string, [number, number]> = {
  concepts: [2, 5],
  scenes: [3, 6],
  quizzes: [1, 2],
  options: [3, 4],
  items: [2, 4],
  steps: [2, 4],
  leftItems: [1, 3],
  rightItems: [1, 3],
};
const STRING_LIMITS: Record<string, number> = {
  narration: 220,
  code: 400,
  sourceExcerpt: 300,
  goal: 150,
  definition: 140,
  explanation: 200,
  problem: 140,
  solution: 140,
  latex: 150,
  emoji: 8,
  language: 12,
  // экранный текст: иначе 0.6B пишет абзацы на весь кадр
  text: 70,
  heading: 45,
  term: 40,
  title: 50,
  courseTitle: 60,
  caption: 70,
  items: 60,
  steps: 60,
  leftItems: 50,
  rightItems: 50,
  options: 70,
};

type JsonObject = { [key: string]: unknown };

function constrain(node: unknown, key?: string): unknown {
  if (Array.isArray(node)) return node.map((n) => constrain(n));
  if (!node || typeof node !== "object") return node;
  const out: JsonObject = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] =
      k === "properties"
        ? Object.fromEntries(Object.entries(v as JsonObject).map(([name, prop]) => [name, constrain(prop, name)]))
        : constrain(v);
  }
  if (out.type === "array" && key && ARRAY_LIMITS[key]) [out.minItems, out.maxItems] = ARRAY_LIMITS[key];
  // строки внутри массива (items, steps, options) получают лимит по имени массива
  const itemSchema = out.items as JsonObject | undefined;
  if (out.type === "array" && key && STRING_LIMITS[key] && itemSchema?.type === "string") {
    out.items = { ...itemSchema, maxLength: STRING_LIMITS[key] };
  }
  if (out.type === "string" && !("const" in out) && !("enum" in out)) out.maxLength = STRING_LIMITS[key ?? ""] ?? 120;
  if (out.type === "integer" && key === "correctIndex") Object.assign(out, { minimum: 0, maximum: 3 });
  return out;
}

const textCache = new WeakMap<Material, Promise<string>>();

export function materialText(material: Material): Promise<string> {
  let cached = textCache.get(material);
  if (!cached) {
    cached = extractText(material);
    textCache.set(material, cached);
  }
  return cached;
}

async function extractText(material: Material): Promise<string> {
  let text: string;
  if (material.kind === "text") {
    text = material.text;
  } else {
    const file = path.join(os.tmpdir(), `learntok-${process.pid}-${Date.now()}.pdf`);
    fs.writeFileSync(file, Buffer.from(material.base64, "base64"));
    try {
      text = await new Promise<string>((resolve, reject) =>
        execFile("pdftotext", ["-enc", "UTF-8", file, "-"], { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) =>
          err ? reject(new Error(`pdftotext: ${err.message}`)) : resolve(stdout),
        ),
      );
    } finally {
      fs.rmSync(file, { force: true });
    }
  }
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("В материале не нашлось текста (скан PDF без текстового слоя?)");
  return text;
}

type ChatResponse = { choices: { message: { content: string | null }; finish_reason: string }[] };

export async function askLocal<T extends z.ZodType>(
  system: string,
  material: Material,
  instruction: string,
  schema: T,
): Promise<z.infer<T>> {
  // Длинный материал не режем по голове, а отбираем куски, релевантные задаче (план / тема урока).
  const text = retrieve(await materialText(material), instruction, LOCAL_MAX_CHARS);
  const jsonSchema = constrain(z.toJSONSchema(schema));
  const grammar = LOCAL_JSON_MODE === "grammar";
  const systemPrompt = grammar
    ? system
    : `${system}\n\nОтвечай ТОЛЬКО валидным JSON по этой схеме, без markdown и пояснений:\n${JSON.stringify(jsonSchema)}`;
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${LOCAL_LLM_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: LOCAL_MODEL,
          temperature: 0.6,
          top_p: 0.9,
          max_tokens: 4096,
          chat_template_kwargs: { enable_thinking: false },
          ...(grammar ? { response_format: { type: "json_schema", json_schema: { name: "result", schema: jsonSchema } } } : {}),
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Материал «${material.name}»:\n"""\n${text}\n"""\n\n${instruction}\n\nОтветь только JSON по схеме.`,
            },
          ],
        }),
      });
    } catch {
      throw new LlmUnavailableError(`Локальная модель недоступна на ${LOCAL_LLM_URL} — запусти npm run llm`);
    }

    if (!res.ok) {
      lastError = `LLM-сервер ${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (res.status < 500) break;
      continue;
    }

    const choice = ((await res.json()) as ChatResponse).choices[0];
    try {
      // без грамматики модель иногда оборачивает ответ в ```json
      const raw = (choice?.message.content ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.message.slice(0, 300);
    } catch {
      lastError = `невалидный JSON (finish_reason: ${choice?.finish_reason})`;
    }
  }
  throw new Error(`${LOCAL_MODEL} не справилась: ${lastError}`);
}
