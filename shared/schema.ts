import { z } from "zod";

// ---- То, что генерирует LLM (structured outputs) ----

const narration = z
  .string()
  .describe(
    "Озвучка сцены: 1–3 коротких разговорных предложения. Без LaTeX, кода, markdown и спецсимволов — формулы и код проговариваются словами.",
  );

export const SceneSchema = z.union([
  z.object({
    type: z.literal("hook"),
    narration,
    emoji: z.string().describe("Один эмодзи"),
    text: z.string().describe("Цепляющий вопрос или факт, до 12 слов"),
  }),
  z.object({
    type: z.literal("definition"),
    narration,
    term: z.string(),
    definition: z.string().describe("Определение, до 25 слов"),
  }),
  z.object({
    type: z.literal("bullets"),
    narration,
    heading: z.string(),
    items: z.array(z.string()).describe("2–4 пункта, до 8 слов каждый"),
  }),
  z.object({
    type: z.literal("formula"),
    narration,
    latex: z.string().describe("Валидный KaTeX без обрамляющих $"),
    caption: z.string(),
  }),
  z.object({
    type: z.literal("code"),
    narration,
    language: z.string().describe("python, javascript, cpp, sql и т.п."),
    code: z.string().describe("До 12 строк, до 38 символов в строке"),
    caption: z.string(),
  }),
  z.object({
    type: z.literal("steps"),
    narration,
    heading: z.string(),
    steps: z.array(z.string()).describe("2–5 шагов, до 8 слов каждый"),
  }),
  z.object({
    type: z.literal("compare"),
    narration,
    leftTitle: z.string(),
    leftItems: z.array(z.string()),
    rightTitle: z.string(),
    rightItems: z.array(z.string()),
  }),
  z.object({
    type: z.literal("example"),
    narration,
    problem: z.string(),
    solution: z.string(),
  }),
  z.object({
    type: z.literal("summary"),
    narration,
    text: z.string().describe("Главная мысль, до 15 слов"),
  }),
]);

export const QuizSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).describe("3–4 варианта"),
  correctIndex: z.number().int().describe("Индекс верного варианта, с нуля"),
  explanation: z.string(),
});

export const LessonDraftSchema = z.object({
  title: z.string().describe("Название ролика, до 6 слов"),
  scenes: z.array(SceneSchema),
  quizzes: z.array(QuizSchema),
});

export const OutlineSchema = z.object({
  courseTitle: z.string(),
  language: z.string().describe("Язык материала, BCP-47: ru-RU, en-US…"),
  concepts: z.array(
    z.object({
      title: z.string(),
      goal: z.string().describe("Что зритель поймёт после ролика, одно предложение"),
      sourceExcerpt: z.string().describe("Дословная цитата из материала, 1–3 предложения"),
    }),
  ),
});

export type Scene = z.infer<typeof SceneSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type LessonDraft = z.infer<typeof LessonDraftSchema>;
export type Outline = z.infer<typeof OutlineSchema>;

// ---- То, что хранится и отдаётся клиенту ----

export type WordTiming = { text: string; start: number; end: number };
export type SceneAudio = { src: string; duration: number; words: WordTiming[] };
export type LessonScene = Scene & { audio: SceneAudio | null };

export type Mp4State = {
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  error?: string;
};

export type Lesson = {
  id: string;
  index: number;
  title: string;
  goal: string;
  sourceExcerpt: string;
  scenes: LessonScene[];
  quizzes: Quiz[];
  mp4?: Mp4State;
};

export type VoiceGender = "female" | "male";
export type CourseStatus = "outlining" | "generating" | "ready" | "error";

export type Course = {
  id: string;
  title: string;
  sourceName: string;
  createdAt: string;
  status: CourseStatus;
  error?: string;
  voice: VoiceGender;
  language?: string;
  total: number;
  failed: { index: number; title: string; error: string }[];
  lessons: Lesson[];
};

export type CourseSummary = Pick<
  Course,
  "id" | "title" | "sourceName" | "createdAt" | "status" | "error" | "total"
> & { done: number };
