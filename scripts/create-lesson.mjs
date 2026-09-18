#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const exec = promisify(execFile);
const values = process.argv.slice(2);
const option = (name) => { const index = values.indexOf(name); return index === -1 ? undefined : values[index + 1]; };
const input = option("--input");
const output = option("--out") || "public/generated/lesson.json";
if (!input) throw new Error("Использование: npm run lesson -- --input material.pdf [--out public/generated/lesson.json]");
const clean = (text) => text.replace(/\s+/g, " ").trim();
const split = (text) => (text.match(/[^.!?]+[.!?]+/g) || []).map(clean).filter((text) => text.length > 35);

async function extractPdf(file) {
  try { const {stdout} = await exec("pdftotext", [file, "-"]); if (clean(stdout).length > 100) return clean(stdout); } catch {}
  const raw = (await readFile(file)).toString("latin1");
  return clean([...raw.matchAll(/\(([^()]{15,})\)/g)].map((match) => { const literal = match[1].replace(/\\([()\\])/g, "$1"); const utf8 = Buffer.from(literal, "latin1").toString("utf8"); return utf8.includes("�") ? literal : utf8; }).join(" "));
}
function retrieve(text, title) {
  const terms = new Set(`${title} ${text.slice(0, 800)}`.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
  const source = split(text); const chunks = [];
  for (let index = 0; index < source.length; index += 5) chunks.push(source.slice(index, index + 6).join(" "));
  return chunks.map((chunk) => ({chunk, score: [...terms].reduce((sum, term) => sum + Number(chunk.toLowerCase().includes(term)), 0)})).sort((a, b) => b.score - a.score).slice(0, 7).map(({chunk}) => chunk).join("\n");
}
function fallback(context, title, sourceName) {
  const source = split(context);
  return {title, hook: source[0] || "Коротко разбираем главные идеи материала.", keyPoints: source.slice(1, 4).map((sentence) => sentence.slice(0, 175)), takeaway: (source[4] || source[0] || "Главные идеи собраны в короткий урок.").slice(0, 190), sourceName};
}
async function summarize(context, title, sourceName) {
  const prompt = `Верни только JSON сценария русского 60-секундного урока: {"title":"","hook":"","keyPoints":["","",""] ,"takeaway":"","sourceName":""}. Используй ТОЛЬКО контекст. hook до 150 символов, пункты и вывод до 180.\n\n${context}`;
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({model: process.env.OLLAMA_MODEL || "qwen2.5:1.5b", prompt, format: "json", stream: false, options: {temperature: 0.25, num_predict: 450}})});
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const result = JSON.parse((await response.json()).response);
    return {...result, sourceName: result.sourceName || sourceName};
  } catch (error) { console.warn(`LLM недоступна (${error.message}); применена extractive-выжимка.`); return fallback(context, title, sourceName); }
}
const sourceName = path.basename(input, path.extname(input));
const text = await extractPdf(input);
if (text.length < 80) throw new Error("Не удалось извлечь текст: для сканированного PDF нужен OCR, для обычного — pdftotext.");
const lesson = await summarize(retrieve(text, sourceName.replace(/[-_]/g, " ")), sourceName.replace(/[-_]/g, " "), sourceName);
await mkdir(path.dirname(output), {recursive: true});
await writeFile(output, JSON.stringify(lesson, null, 2));
console.log(`Готово: ${output}`);
