import React, { useMemo } from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { LessonScene, WordTiming } from "../shared/schema";
import { FONT, SceneView } from "./scenes";
import { FPS, LEAD, sceneFrames } from "./timing";

export type LessonProps = {
  lesson: { index: number; title: string; scenes: LessonScene[]; courseTitle?: string };
  /** Префикс для audio.src; в ленте — "/media/<courseId>/", при рендере — абсолютный URL. */
  mediaBase: string;
  /** Query-строка для доступа рендерера к приватным медиа. */
  mediaQuery?: string;
};

const PALETTE = ["#8b6cff", "#00c9a7", "#ff8a5c", "#4aa8ff", "#ffc93c", "#ff5c9a"];

export function accentFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Фон: глубокий градиент, два медленно плывущих пятна акцента, сетка и виньетка снизу под субтитры. */
const Backdrop: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 90) * 70;
  const drift2 = Math.cos(frame / 110) * 50;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #0d0f1f 0%, #0a0b14 60%, #07080f 100%)" }}>
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          left: -520 + drift,
          top: -520 + drift2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}66 0%, ${accent}22 35%, transparent 65%)`,
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -560 - drift,
          bottom: -300 + drift2,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}44 0%, transparent 62%)`,
          filter: "blur(10px)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
          maskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 80%)",
        }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, transparent 55%, rgba(5,6,12,0.75) 100%)" }} />
    </AbsoluteFill>
  );
};

type WordGroup = { start: number; words: WordTiming[] };

function groupWords(words: WordTiming[], maxChars = 30): WordGroup[] {
  const groups: WordGroup[] = [];
  let current: WordGroup | null = null;
  let chars = 0;
  for (const w of words) {
    const prev = current?.words.at(-1)?.text ?? "";
    if (!current || chars + w.text.length > maxChars || /[.!?…]$/.test(prev)) {
      current = { start: w.start, words: [] };
      groups.push(current);
      chars = 0;
    }
    current.words.push(w);
    chars += w.text.length + 1;
  }
  return groups;
}

/** Субтитры-караоке в плашке: текущее слово подсвечено акцентом. */
const Captions: React.FC<{ words: WordTiming[]; accent: string }> = ({ words, accent }) => {
  const t = useCurrentFrame() / FPS;
  const groups = useMemo(() => groupWords(words), [words]);
  const group = groups.findLast((g) => g.start <= t + 0.05);
  if (!group) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 330 }}>
      <div
        style={{
          maxWidth: 940,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.35,
          padding: "22px 36px",
          borderRadius: 32,
          background: "rgba(8,9,18,0.62)",
          border: "2px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(14px)",
        }}
      >
        {group.words.map((w, i) => {
          const active = t >= w.start && t < w.end + 0.08;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 3px",
                padding: "0 10px",
                borderRadius: 14,
                color: active ? "#0a0b14" : t >= w.start ? "#fff" : "rgba(255,255,255,0.5)",
                background: active ? accent : "transparent",
                transition: "background 80ms",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{ title: string; courseTitle?: string; index: number; starts: number[]; durations: number[]; accent: string }> = ({
  title,
  courseTitle,
  index,
  starts,
  durations,
  accent,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: "100px 60px 0", fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 10 }}>
        {starts.map((start, i) => (
          <div key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.16)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: accent,
                width: `${interpolate(frame, [start, start + durations[i]], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 18 }}>
        <span
          style={{
            background: accent,
            color: "#0a0b14",
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: 2,
            padding: "8px 18px",
            borderRadius: 999,
            textTransform: "uppercase",
          }}
        >
          Урок {index + 1}
        </span>
        <span style={{ fontSize: 34, fontWeight: 700, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
      </div>
      {courseTitle && (
        <div style={{ marginTop: 10, fontSize: 26, color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {courseTitle}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const LessonVideo: React.FC<LessonProps> = ({ lesson, mediaBase, mediaQuery = "" }) => {
  const accent = accentFor(lesson.title);
  const durations = lesson.scenes.map(sceneFrames);
  const starts = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <AbsoluteFill style={{ background: "#0a0b14", color: "#fff", overflow: "hidden" }}>
      <Backdrop accent={accent} />
      {lesson.scenes.map((scene, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={durations[i]} name={`${i + 1}. ${scene.type}`}>
          <FadeOut duration={durations[i]}>
            <SceneView scene={scene} accent={accent} durationInFrames={durations[i]} />
          </FadeOut>
          {scene.audio && (
            <Sequence from={Math.round(LEAD * FPS)}>
              <Html5Audio src={mediaBase + scene.audio.src + mediaQuery} />
              <Captions words={scene.audio.words} accent={accent} />
            </Sequence>
          )}
        </Sequence>
      ))}
      <TopBar title={lesson.title} courseTitle={lesson.courseTitle} index={lesson.index} starts={starts} durations={durations} accent={accent} />
      <div style={{ position: "absolute", right: 60, top: 150, fontFamily: FONT, fontSize: 26, fontWeight: 900, letterSpacing: 2, color: "rgba(255,255,255,0.4)" }}>
        ETAP
      </div>
    </AbsoluteFill>
  );
};

const FadeOut: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
