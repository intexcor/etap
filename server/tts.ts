import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LessonScene, Scene, VoiceGender, WordTiming } from "../shared/schema";
import { PYTHON, ROOT } from "./config";

const VOICES: Record<string, Record<VoiceGender, string>> = {
  ru: { female: "ru-RU-SvetlanaNeural", male: "ru-RU-DmitryNeural" },
  en: { female: "en-US-AvaNeural", male: "en-US-AndrewNeural" },
};
// Мультиязычные голоса читают почти любой язык.
const FALLBACK: Record<VoiceGender, string> = {
  female: "en-US-AvaMultilingualNeural",
  male: "en-US-AndrewMultilingualNeural",
};

export function pickVoice(language: string | undefined, gender: VoiceGender) {
  // Модели иногда пишут «Русский» / «English» вместо BCP-47.
  const raw = (language ?? "ru").trim().toLowerCase();
  const lang = /^рус|russian/.test(raw) ? "ru" : /^англ|english/.test(raw) ? "en" : raw.slice(0, 2);
  return VOICES[lang]?.[gender] ?? FALLBACK[gender];
}

type PyResult = { ok: true; words: WordTiming[] } | { ok: false; error: string };

function runTts(jobs: { text: string; voice: string; rate: string; out: string }[]): Promise<PyResult[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [path.join(ROOT, "server", "tts.py")]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`TTS упал (${code}): ${stderr.slice(-500)}`));
      resolve(JSON.parse(stdout));
    });
    child.stdin.end(JSON.stringify(jobs));
  });
}

function probeDuration(file: string): Promise<number | null> {
  return new Promise((resolve) => {
    execFile("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], (err, out) => {
      const value = Number.parseFloat(out);
      resolve(err || Number.isNaN(value) ? null : value);
    });
  });
}

const speechText = (s: string) => s.replace(/[$`*_#]/g, "").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// WordBoundary отдаёт слова без пунктуации — возвращаем её из исходного текста для субтитров.
function attachPunctuation(narration: string, words: WordTiming[]): WordTiming[] {
  const tokens = speechText(narration).split(" ").filter((t) => norm(t));
  let next = 0;
  return words.map((w) => {
    const key = norm(w.text);
    for (let j = next; j < Math.min(tokens.length, next + 4); j++) {
      const token = norm(tokens[j]);
      if (key && (token.startsWith(key) || key.startsWith(token))) {
        next = j + 1;
        return { ...w, text: tokens[j] };
      }
    }
    return w;
  });
}

export async function synthesizeScenes(
  scenes: Scene[],
  dir: string,
  prefix: string,
  voice: string,
): Promise<LessonScene[]> {
  const audioDir = path.join(dir, "audio");
  fs.mkdirSync(audioDir, { recursive: true });
  const files = scenes.map((_, i) => `audio/${prefix}-${i}.mp3`);
  const results = await runTts(
    scenes.map((s, i) => ({ text: speechText(s.narration), voice, rate: "+6%", out: path.join(dir, files[i]) })),
  );
  return Promise.all(
    scenes.map(async (scene, i): Promise<LessonScene> => {
      const r = results[i];
      if (!r.ok) {
        console.error(`TTS: сцена ${prefix}-${i} без озвучки: ${r.error}`);
        return { ...scene, audio: null };
      }
      const lastEnd = r.words.at(-1)?.end ?? 2;
      const duration = (await probeDuration(path.join(dir, files[i]))) ?? lastEnd + 0.3;
      return { ...scene, audio: { src: files[i], duration, words: attachPunctuation(scene.narration, r.words) } };
    }),
  );
}
