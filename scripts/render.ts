// Рендер урока в MP4 из консоли: npm run render -- <courseId> <lessonId>
// API-сервер должен быть запущен — аудио берётся с него.
import { mp4Path, renderLesson } from "../server/render";
import { getCourse } from "../server/store";

const [courseId, lessonId] = process.argv.slice(2);
if (!courseId || !lessonId) {
  console.error("Использование: npm run render -- <courseId> <lessonId>");
  process.exit(1);
}

const started = Date.now();
await renderLesson(courseId, lessonId);
const lesson = getCourse(courseId)?.lessons.find((l) => l.id === lessonId);
if (lesson?.mp4?.status !== "done") {
  console.error("Не получилось:", lesson?.mp4?.error);
  process.exit(1);
}
console.log(`${mp4Path(courseId, lessonId)} за ${((Date.now() - started) / 1000).toFixed(0)} с`);
