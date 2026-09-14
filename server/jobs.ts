import { nanoid } from "nanoid";
import type { Course, Quiz, VoiceGender } from "../shared/schema";
import { describeError, generateLesson, generateOutline, type Material } from "./generate";
import { courseDir, saveCourse } from "./store";
import { pickVoice, synthesizeScenes } from "./tts";

const LESSON_CONCURRENCY = 3;

export function createCourse(sourceName: string, voice: VoiceGender): Course {
  const course: Course = {
    id: nanoid(10),
    title: sourceName,
    sourceName,
    createdAt: new Date().toISOString(),
    status: "outlining",
    voice,
    total: 0,
    failed: [],
    lessons: [],
  };
  saveCourse(course);
  return course;
}

// Убираем повторы вариантов (слабые модели дублируют) и перемешиваем:
// модели часто ставят верный ответ первым.
function normalizeQuiz(quiz: Quiz): Quiz | null {
  const correctText = quiz.options[Math.min(Math.max(quiz.correctIndex, 0), quiz.options.length - 1)];
  const options = [...new Set(quiz.options.map((o) => o.trim()).filter(Boolean))];
  if (options.length < 2 || correctText === undefined) return null;
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return { ...quiz, options: shuffled, correctIndex: shuffled.indexOf(correctText.trim()) };
}

// Зацепка — первой, вывод — последним, даже если модель перепутала порядок.
function orderScenes<T extends { type: string }>(scenes: T[]): T[] {
  const rank = (s: T) => (s.type === "hook" ? 0 : s.type === "summary" ? 2 : 1);
  return [...scenes].sort((a, b) => rank(a) - rank(b));
}

async function runPool(tasks: (() => Promise<void>)[], limit: number) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]();
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export async function runCourse(course: Course, material: Material, lessons: number | "auto") {
  try {
    const outline = await generateOutline(material, lessons);
    course.title = outline.courseTitle;
    course.language = outline.language;
    course.total = outline.concepts.length;
    course.status = "generating";
    saveCourse(course);

    const voice = pickVoice(outline.language, course.voice);
    await runPool(
      outline.concepts.map((concept, index) => async () => {
        try {
          const draft = await generateLesson(material, outline, index);
          const id = `l${index + 1}-${nanoid(6)}`;
          const scenes = await synthesizeScenes(orderScenes(draft.scenes), courseDir(course.id), id, voice);
          course.lessons.push({
            id,
            index,
            title: draft.title,
            goal: concept.goal,
            sourceExcerpt: concept.sourceExcerpt,
            scenes,
            quizzes: draft.quizzes.map(normalizeQuiz).filter((q): q is Quiz => q !== null),
          });
          course.lessons.sort((a, b) => a.index - b.index);
        } catch (e) {
          console.error(`Урок ${index + 1} «${concept.title}»:`, e);
          course.failed.push({ index, title: concept.title, error: describeError(e) });
        }
        saveCourse(course);
      }),
      LESSON_CONCURRENCY,
    );

    course.status = course.lessons.length ? "ready" : "error";
    if (!course.lessons.length) course.error = course.failed[0]?.error ?? "Не получилось сгенерировать уроки";
  } catch (e) {
    console.error(`Курс ${course.id}:`, e);
    course.status = "error";
    course.error = describeError(e);
  }
  saveCourse(course);
}
