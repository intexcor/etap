import { purgeExpiredSessions } from "./auth";
import { LOCAL_MODEL, MODEL, PORT, PROVIDER } from "./config";
import { createApp } from "./app";
import { getDb } from "./db";
import { log } from "./log";
import { startWorker, stopWorker } from "./queue";
// Регистрируют обработчики очереди.
import "./pipeline";
import "./render";

getDb();
purgeExpiredSessions();
startWorker();

const server = createApp().listen(PORT, () => {
  log.info({ port: PORT, generation: PROVIDER === "claude" ? MODEL : PROVIDER === "none" ? "extractive (без LLM)" : `${PROVIDER}:${LOCAL_MODEL}` }, "LearnTok API started");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopWorker();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
