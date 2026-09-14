import React from "react";
import { Composition } from "remotion";
import { LessonVideo, type LessonProps } from "./Lesson";
import { FPS, HEIGHT, WIDTH, lessonFrames } from "./timing";

const placeholder: LessonProps = {
  mediaBase: "",
  lesson: {
    index: 0,
    title: "Пример",
    scenes: [{ type: "hook", narration: "", emoji: "🎬", text: "Здесь будет урок", audio: null }],
  },
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Lesson"
    component={LessonVideo}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={lessonFrames(placeholder.lesson)}
    defaultProps={placeholder}
    calculateMetadata={({ props }) => ({ durationInFrames: lessonFrames(props.lesson) })}
  />
);
