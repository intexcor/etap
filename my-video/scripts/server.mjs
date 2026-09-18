import {createServer} from "node:http";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawn} from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = await readFile(path.join(root, "web/index.html"));
const readBody = (request) => new Promise((resolve, reject) => { const parts = []; let size = 0; request.on("data", (part) => { size += part.length; if (size > 15_000_000) reject(new Error("PDF больше 15 МБ")); else parts.push(part); }); request.on("end", () => resolve(Buffer.concat(parts))); request.on("error", reject); });
const run = (command, args) => new Promise((resolve, reject) => { const child = spawn(command, args, {cwd: root, env: process.env}); let stderr = ""; child.stderr.on("data", (part) => stderr += part); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || `Процесс завершился с кодом ${code}`))); });

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") { response.writeHead(200, {"content-type": "text/html; charset=utf-8"}); return response.end(page); }
  if (request.method !== "POST" || request.url !== "/api/lesson") { response.writeHead(404); return response.end(); }
  let folder;
  try {
    const body = await readBody(request); if (!body.slice(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Нужен PDF-файл.");
    folder = await mkdtemp(path.join(tmpdir(), "etap-"));
    const safeName = path.basename(decodeURIComponent(String(request.headers["x-file-name"] || "material.pdf"))).replace(/[^\w.()-]/g, "_");
    const input = path.join(folder, safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`); const output = path.join(folder, "lesson.json");
    await writeFile(input, body); await run(process.execPath, ["scripts/create-lesson.mjs", "--input", input, "--out", output]);
    response.writeHead(200, {"content-type": "application/json; charset=utf-8"}); response.end(await readFile(output));
  } catch (error) { response.writeHead(422, {"content-type": "application/json; charset=utf-8"}); response.end(JSON.stringify({error: error.message})); }
  finally { if (folder) await rm(folder, {recursive: true, force: true}); }
}).listen(4173, () => console.log("ETAP MVP: http://localhost:4173"));
