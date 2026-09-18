import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { LessonDraftSchema, OutlineSchema, type LessonDraft, type Outline } from "../shared/schema";
import { LLM_FALLBACK, MODEL, PROVIDER } from "./config";
import { extractiveLesson, extractiveOutline } from "./extractive";
import { askLocal, LlmUnavailableError, materialText } from "./local";
import { log } from "./log";

export type Material = ({ kind: "pdf"; name: string; base64: string } | { kind: "text"; name: string; text: string }) & {
  /** Есть у курсов из очереди: включает RAG-контекст вместо всего материала. */
  courseId?: string;
};

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const SYSTEM = `Ты — сценарист коротких обучающих вертикальных роликов (формат TikTok/Reels, 30–60 секунд) и методист. Ты превращаешь учебный материал пользователя в серию роликов, по которым человек реально усваивает тему.

Принципы:
- Опирайся на материал пользователя: факты, определения, формулы, код и обозначения бери из него. Если нужен пример, которого нет в материале, он должен быть безусловно корректным.
- Один ролик — одна мысль. Лучше глубже раскрыть одну идею, чем пробежаться по пяти.
- Пиши на языке материала.
- Зритель листает ленту без подготовки: первые секунды цепляют (вопрос, парадокс, практическая польза), дальше ясное объяснение, конкретный пример и короткий вывод.
- Экран и озвучка дополняют друг друга: на экране опорные слова, формулы, код; в озвучке объяснение живым разговорным языком. Озвучка не зачитывает экран дословно.`;

function materialBlock(m: Material): Anthropic.Beta.BetaContentBlockParam {
  // Материал идёт первым и под cache_control: запросы на каждый урок переиспользуют кэш.
  if (m.kind === "pdf") {
    return {
      type: "document",
      title: m.name,
      source: { type: "base64", media_type: "application/pdf", data: m.base64 },
      cache_control: { type: "ephemeral" },
    };
  }
  return {
    type: "document",
    title: m.name,
    source: { type: "text", media_type: "text/plain", data: m.text },
    cache_control: { type: "ephemeral" },
  };
}

async function ask<T extends z.ZodType>(material: Material, instruction: string, schema: T): Promise<z.infer<T>> {
  if (PROVIDER === "local" || PROVIDER === "ollama") return askLocal(SYSTEM, material, instruction, schema);
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content: [materialBlock(material), { type: "text", text: instruction }] }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`Модель отказалась обрабатывать материал: ${response.stop_details?.explanation ?? "без пояснения"}`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Ответ модели обрезан по max_tokens");
  if (!response.parsed_output) throw new Error("Модель вернула ответ не по схеме");
  return response.parsed_output;
}

/** Без LLM (provider=none) или когда локальная модель недоступна — extractive-выжимка из прототипа ETAP. */
async function withFallback<T>(material: Material, llm: () => Promise<T>, extractive: (text: string) => T): Promise<T> {
  if (PROVIDER === "none") return extractive(await materialText(material));
  try {
    return await llm();
  } catch (e) {
    if (!(e instanceof LlmUnavailableError) || !LLM_FALLBACK) throw e;
    log.warn({ err: e.message }, "LLM недоступна — extractive-выжимка");
    return extractive(await materialText(material));
  }
}

export function generateOutline(material: Material, lessons: number | "auto"): Promise<Outline> {
  return withFallback(material, () => llmOutline(material, lessons), (text) => extractiveOutline(text, material.name, lessons));
}

export function generateLesson(material: Material, outline: Outline, index: number): Promise<LessonDraft> {
  return withFallback(material, () => llmLesson(material, outline, index), (text) => extractiveLesson(text, outline, index));
}

function llmOutline(material: Material, lessons: number | "auto"): Promise<Outline> {
  const auto = PROVIDER === "local" ? "от 3 до 5" : "от 3 до 10 (сколько нужно по объёму материала)";
  const count = lessons === "auto" ? auto : `ровно ${lessons}`;
  return ask(
    material,
    `Разбей материал на ${count} атомарных тем для серии роликов.
- Каждая тема раскрывается в одном ролике на 30–60 секунд.
- Порядок от базового к сложному: тема опирается только на предыдущие.
- Покрой главное в материале; второстепенные детали и повторы пропускай.
- sourceExcerpt — дословная цитата из материала, на которой основана тема.`,
    OutlineSchema,
  );
}

function llmLesson(material: Material, outline: Outline, index: number): Promise<LessonDraft> {
  const concept = outline.concepts[index];
  const plan = outline.concepts
    .map((c, i) => `${i + 1}. ${c.title}${i === index ? "   ← этот ролик" : ""}`)
    .join("\n");
  return ask(
    material,
    `План курса «${outline.courseTitle}»:
${plan}

Сделай ролик для темы №${index + 1} «${concept.title}».
Цель: ${concept.goal}
Опорный фрагмент материала: «${concept.sourceExcerpt}»
Предыдущие темы зритель уже посмотрел: не пересказывай их, но можешь на них ссылаться.

Сцены:
- 4–7 сцен; суммарно в озвучке 90–150 слов (35–60 секунд).
- Первая сцена — hook, последняя — summary.
- Тип сцены выбирай по содержанию: формула — formula (валидный KaTeX), код — code (до 12 строк, до 38 символов в строке, язык как в материале), процесс или алгоритм — steps, противопоставление — compare, задача с решением — example, ключевой термин — definition, перечисление — bullets, одна крупная мысль с номером — keypoint.
- В текстовых полях на экране короткие формулы можно вставлять как $...$ (KaTeX).
- Экранный текст короткий и крупный: заголовки до 6 слов, пункты до 8 слов.
- Озвучка пригодна для синтеза речи: без LaTeX, кода, markdown и сокращений; формулы и код проговаривай словами.

Квизы — 2 штуки:
- Проверяют понимание и применение, а не дословное запоминание.
- 3–4 варианта; неверные варианты — правдоподобные типичные ошибки.
- explanation — 1–2 предложения: почему верный ответ верен и в чём ловушка.`,
    LessonDraftSchema,
  );
}

export function describeError(e: unknown): string {
  if (
    e instanceof Anthropic.AuthenticationError ||
    e instanceof Anthropic.PermissionDeniedError ||
    (e instanceof Error && e.message.startsWith("Could not resolve authentication method"))
  ) {
    return "Нет доступа к Claude API — задай ANTHROPIC_API_KEY и перезапусти сервер";
  }
  if (e instanceof Anthropic.RateLimitError) return "Лимит запросов к Claude API, попробуй позже";
  if (e instanceof Anthropic.APIError) return `Claude API ${e.status ?? ""}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
