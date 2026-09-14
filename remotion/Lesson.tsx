import React, { useMemo } from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import type { LessonScene, WordTiming } from "../shared/schema";
import { FONT, SceneView } from "./scenes";
import { FPS, LEAD, sceneFrames } from "./timing";

export type LessonProps = {
  lesson: { index: number; title: string; scenes: LessonScene[] };
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

const Backdrop: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 60;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          width: 1200,
          height: 1200,
          left: -500 + drift,
          top: -450,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}55, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -520 - drift,
          bottom: -380,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}33, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

type WordGroup = { start: number; words: WordTiming[] };

function groupWords(words: WordTiming[], maxChars = 24): WordGroup[] {
  const groups: WordGroup[] = [];
  let current: WordGroup | null = null;
  let chars = 0;
  for (const w of words) {
    const prev = current?.words.at(-1)?.text ?? "";
    if (!current || chars + w.text.length > maxChars || /[.!?…:;]$/.test(prev)) {
      current = { start: w.start, words: [] };
      groups.push(current);
      chars = 0;
    }
    current.words.push(w);
    chars += w.text.length + 1;
  }
  return groups;
}

const Captions: React.FC<{ words: WordTiming[]; accent: string }> = ({ words, accent }) => {
  const t = useCurrentFrame() / FPS;
  const groups = useMemo(() => groupWords(words), [words]);
  const group = groups.findLast((g) => g.start <= t + 0.05);
  if (!group) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 400 }}>
      <div
        style={{
          maxWidth: 960,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 64,
          fontWeight: 800,
          lineHeight: 1.3,
          textShadow: "0 4px 18px rgba(0,0,0,0.7)",
        }}
      >
        {group.words.map((w, i) => {
          const active = t >= w.start && t < w.end + 0.08;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 4px",
                padding: "0 12px",
                borderRadius: 16,
                color: active ? "#0a0b14" : t >= w.start ? "#fff" : "rgba(255,255,255,0.55)",
                background: active ? accent : "transparent",
                textShadow: active ? "none" : undefined,
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

const TopBar: React.FC<{ title: string; starts: number[]; durations: number[]; accent: string }> = ({
  title,
  starts,
  durations,
  accent,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: "120px 60px 0", fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 10 }}>
        {starts.map((start, i) => (
          <div key={i} style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
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
      <div style={{ marginTop: 30, fontSize: 38, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{title}</div>
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
      <TopBar title={`${lesson.index + 1}. ${lesson.title}`} starts={starts} durations={durations} accent={accent} />
    </AbsoluteFill>
  );
};

const FadeOut: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
