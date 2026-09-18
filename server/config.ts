import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PORT = Number(process.env.PORT ?? 8787);
export const DATA_DIR = path.resolve(process.env.LEARNTOK_DATA ?? path.join(ROOT, "data"));
export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, "");
/** Закрыть регистрацию (например, для приватного инстанса). */
export const REGISTRATION_OPEN = process.env.LEARNTOK_REGISTRATION !== "closed";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const MODEL = process.env.LEARNTOK_MODEL ?? "claude-opus-5";

export type Provider = "claude" | "local" | "ollama" | "none";
/**
 * claude — основной; local — OpenAI-совместимый сервер (vllm-mlx / llama.cpp);
 * ollama — то же через Ollama (:11434); none — extractive-выжимка без LLM, для проверки пайплайна.
 */
export const PROVIDER: Provider = (() => {
  const p = process.env.LEARNTOK_PROVIDER;
  if (p === "claude" || p === "local" || p === "ollama" || p === "none") return p;
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? "claude" : "local";
})();
export const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL ?? (PROVIDER === "ollama" ? "http://127.0.0.1:11434" : "http://127.0.0.1:8082");
export const LOCAL_MODEL = process.env.LOCAL_MODEL ?? (PROVIDER === "ollama" ? "qwen2.5:1.5b" : "Qwen3-4B");
/** Если модель недоступна — не падать, а собрать урок extractive-выжимкой. */
export const LLM_FALLBACK = process.env.LEARNTOK_LLM_FALLBACK !== "off";
/**
 * grammar — response_format json_schema (llama.cpp: GBNF на C++, почти бесплатно; vllm-mlx: Python-энфорсер, в 5–10 раз медленнее).
 * prompt — схема в системном промпте + zod-валидация с повторами; для vllm-mlx и моделей от 4B.
 */
export const LOCAL_JSON_MODE: "grammar" | "prompt" =
  process.env.LOCAL_JSON_MODE === "grammar" || process.env.LOCAL_JSON_MODE === "prompt"
    ? process.env.LOCAL_JSON_MODE
    : PROVIDER === "ollama"
      ? "grammar" // Ollama держит json_schema нативно и быстро
      : "prompt";
export const LOCAL_MAX_CHARS = Number(process.env.LOCAL_MAX_CHARS ?? 8000);
export const PYTHON = process.env.PYTHON ?? "python3";
const SYSTEM_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/**
 * Браузер для рендера MP4. По умолчанию Remotion сам качает chrome-headless-shell (~95 МБ),
 * но с googleapis это бывает очень медленно — тогда берём установленный Chrome.
 */
export const BROWSER_EXECUTABLE =
  process.env.REMOTION_BROWSER_EXECUTABLE ?? (!hasDownloadedShell() && fs.existsSync(SYSTEM_CHROME) ? SYSTEM_CHROME : null);

/** Ищем сам бинарник: недокачанный архив оставляет пустую папку. */
function hasDownloadedShell() {
  const dir = path.join(ROOT, "node_modules", ".remotion", "chrome-headless-shell");
  if (!fs.existsSync(dir)) return false;
  return fs
    .readdirSync(dir, { recursive: true, encoding: "utf8" })
    .some((f) => /chrome-headless-shell(\.exe)?$/.test(path.basename(f)) && fs.statSync(path.join(dir, f)).isFile());
}
