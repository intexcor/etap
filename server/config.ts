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

/** claude — основной; local — llama-server с маленькой моделью, пока нет ключа Anthropic. */
export const PROVIDER: "claude" | "local" =
  process.env.LEARNTOK_PROVIDER === "claude" || process.env.LEARNTOK_PROVIDER === "local"
    ? process.env.LEARNTOK_PROVIDER
    : process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
      ? "claude"
      : "local";
export const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL ?? "http://127.0.0.1:8081";
export const LOCAL_MODEL = process.env.LOCAL_MODEL ?? "Qwen3-0.6B";
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
