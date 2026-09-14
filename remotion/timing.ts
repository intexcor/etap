import type { Lesson, LessonScene } from "../shared/schema";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
/** Пауза перед озвучкой сцены, секунды. */
export const LEAD = 0.25;
/** Пауза после озвучки сцены, секунды. */
export const TAIL = 0.45;

export const sceneFrames = (scene: LessonScene) => Math.ceil((LEAD + (scene.audio?.duration ?? 3) + TAIL) * FPS);

export const lessonFrames = (lesson: Pick<Lesson, "scenes">) =>
  Math.max(1, lesson.scenes.reduce((sum, s) => sum + sceneFrames(s), 0));
