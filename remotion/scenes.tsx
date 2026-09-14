import "katex/dist/katex.min.css";
import katex from "katex";
import { Highlight, themes } from "prism-react-renderer";
import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { LessonScene } from "../shared/schema";

export const FONT = `Inter, "SF Pro Display", -apple-system, "Segoe UI", Roboto, sans-serif`;
const MONO = `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace`;

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "2px solid rgba(255,255,255,0.09)",
  borderRadius: 36,
  padding: "36px 44px",
};

/** Уменьшает шрифт для длинного текста. */
const fit = (len: number, base: number, ideal: number, min: number) =>
  len <= ideal ? base : Math.max(min, Math.round(base * Math.sqrt(ideal / len)));

/** Кадр появления i-го из n элементов: растягиваем по первой половине сцены. */
const stagger = (i: number, n: number, dur: number) => Math.round(6 + (n <= 1 ? 0 : (i / n) * dur * 0.5));

const Appear: React.FC<{ at: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  at,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = frame < at ? 0 : spring({ frame: frame - at, fps, config: { damping: 200 }, durationInFrames: 20 });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 48}px)`, ...style }}>{children}</div>;
};

/**
 * Чинит LaTeX от слабых моделей: лишние $ вокруг формулы и недоэкранированные
 * в JSON команды — "\text" приходит как TAB + "ext", "\frac" как FF + "rac".
 */
export function cleanLatex(latex: string): string {
  return latex
    .trim()
    .replace(/^\$+|\$+$/g, "")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f")
    .replace(/\x08/g, "\\b")
    .replace(/\r/g, "\\r")
    .replace(/\n(?=[a-zA-Z])/g, "\\n")
    .replace(/\n/g, " ");
}

/** Текст с инлайн-формулами $...$ */
export const Rich: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\$[^$]+\$)/g).map((part, i) =>
      part.length > 2 && part.startsWith("$") && part.endsWith("$") ? (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: katex.renderToString(cleanLatex(part), { throwOnError: false }) }}
        />
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

/** Сжимает содержимое по ширине, если оно не влезает (длинные формулы). */
const FitWidth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (outer.current && inner.current) {
      setScale(Math.min(1, (outer.current.clientWidth / inner.current.scrollWidth) * 0.96));
    }
  }, [children]);
  return (
    <div ref={outer} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div ref={inner} style={{ transform: `scale(${scale})`, whiteSpace: "nowrap" }}>
        {children}
      </div>
    </div>
  );
};

const Heading: React.FC<{ text: string; at?: number }> = ({ text, at = 0 }) => (
  <Appear at={at} style={{ fontSize: fit(text.length, 70, 22, 50), fontWeight: 800, lineHeight: 1.1, marginBottom: 44 }}>
    <Rich text={text} />
  </Appear>
);

const Caption: React.FC<{ text: string; at: number }> = ({ text, at }) => (
  <Appear at={at} style={{ fontSize: 46, color: "rgba(255,255,255,0.72)", marginTop: 36, lineHeight: 1.3 }}>
    <Rich text={text} />
  </Appear>
);

const LANG_ALIASES: Record<string, string> = { "c++": "cpp", js: "javascript", ts: "typescript", py: "python", sh: "bash" };

export const SceneView: React.FC<{ scene: LessonScene; accent: string; durationInFrames: number }> = ({
  scene,
  accent,
  durationInFrames: dur,
}) => {
  const frame = useCurrentFrame();
  let body: React.ReactNode;

  switch (scene.type) {
    case "hook":
      body = (
        <div style={{ textAlign: "center" }}>
          <Appear at={0} style={{ fontSize: 210, marginBottom: 40 }}>
            {scene.emoji}
          </Appear>
          <Appear at={8} style={{ fontSize: fit(scene.text.length, 92, 50, 62), fontWeight: 850, lineHeight: 1.12 }}>
            <Rich text={scene.text} />
          </Appear>
        </div>
      );
      break;

    case "definition":
      body = (
        <>
          <Appear at={2}>
            <span
              style={{
                display: "inline-block",
                background: accent,
                color: "#0a0b14",
                fontSize: fit(scene.term.length, 60, 18, 42),
                fontWeight: 850,
                borderRadius: 999,
                padding: "16px 44px",
              }}
            >
              <Rich text={scene.term} />
            </span>
          </Appear>
          <Appear
            at={14}
            style={{ fontSize: fit(scene.definition.length, 68, 90, 48), fontWeight: 600, lineHeight: 1.28, marginTop: 56 }}
          >
            <Rich text={scene.definition} />
          </Appear>
        </>
      );
      break;

    case "bullets":
      body = (
        <>
          <Heading text={scene.heading} />
          {scene.items.map((item, i) => (
            <Appear
              key={i}
              at={stagger(i + 1, scene.items.length + 1, dur)}
              style={{ ...card, display: "flex", gap: 30, alignItems: "center", marginBottom: 24, fontSize: 52, lineHeight: 1.2 }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, background: accent, flexShrink: 0 }} />
              <span>
                <Rich text={item} />
              </span>
            </Appear>
          ))}
        </>
      );
      break;

    case "formula":
      body = (
        <>
          <Appear at={4} style={{ ...card, padding: "70px 40px", fontSize: fit(scene.latex.length, 96, 28, 56) }}>
            <FitWidth>
              <span
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(cleanLatex(scene.latex), { throwOnError: false, displayMode: true }),
                }}
              />
            </FitWidth>
          </Appear>
          <Caption text={scene.caption} at={18} />
        </>
      );
      break;

    case "code": {
      const code = scene.code.replace(/\s+$/, "");
      const lines = code.split("\n");
      const longest = Math.max(...lines.map((l) => l.length));
      const language = LANG_ALIASES[scene.language.toLowerCase()] ?? scene.language.toLowerCase();
      body = (
        <>
          <Appear at={2} style={{ ...card, background: "#0b1020", padding: "30px 36px 40px" }}>
            <div style={{ display: "flex", gap: 14, marginBottom: 26, alignItems: "center" }}>
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                <span key={c} style={{ width: 20, height: 20, borderRadius: "50%", background: c }} />
              ))}
              <span style={{ marginLeft: "auto", fontSize: 30, color: "rgba(255,255,255,0.5)" }}>{scene.language}</span>
            </div>
            <Highlight theme={themes.nightOwl} code={code} language={language}>
              {({ tokens, getLineProps, getTokenProps }) => (
                <pre
                  style={{
                    margin: 0,
                    fontFamily: MONO,
                    fontSize: longest <= 30 ? 44 : Math.max(26, Math.round((44 * 30) / longest)),
                    lineHeight: 1.45,
                    whiteSpace: "pre",
                    background: "transparent",
                  }}
                >
                  {tokens.map((line, i) => (
                    <div
                      key={i}
                      {...getLineProps({ line })}
                      style={{ opacity: frame >= stagger(i, lines.length, dur) ? 1 : 0.08 }}
                    >
                      {line.map((token, k) => (
                        <span key={k} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </Appear>
          <Caption text={scene.caption} at={Math.round(dur * 0.35)} />
        </>
      );
      break;
    }

    case "steps":
      body = (
        <>
          <Heading text={scene.heading} />
          {scene.steps.map((step, i) => (
            <Appear key={i} at={stagger(i + 1, scene.steps.length + 1, dur)}>
              {i > 0 && <div style={{ textAlign: "center", fontSize: 40, lineHeight: 1, margin: "4px 0", color: accent }}>↓</div>}
              <div style={{ ...card, display: "flex", gap: 30, alignItems: "center", padding: "28px 36px" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: accent,
                    color: "#0a0b14",
                    fontWeight: 900,
                    fontSize: 40,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: fit(step.length, 50, 40, 38), lineHeight: 1.2 }}>
                  <Rich text={step} />
                </span>
              </div>
            </Appear>
          ))}
        </>
      );
      break;

    case "compare": {
      const column = (title: string, items: string[], color: string, at: number) => (
        <Appear at={at} style={{ ...card, flex: 1, padding: "34px 30px", borderColor: color + "88" }}>
          <div style={{ fontSize: 48, fontWeight: 850, color, marginBottom: 26 }}>
            <Rich text={title} />
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ fontSize: 40, lineHeight: 1.25, marginBottom: 18 }}>
              <Rich text={item} />
            </div>
          ))}
        </Appear>
      );
      body = (
        <div style={{ display: "flex", gap: 26 }}>
          {column(scene.leftTitle, scene.leftItems, accent, 4)}
          {column(scene.rightTitle, scene.rightItems, "#ffffff", Math.round(dur * 0.4))}
        </div>
      );
      break;
    }

    case "example":
      body = (
        <>
          <Appear at={2} style={{ ...card, fontSize: fit(scene.problem.length, 54, 80, 40), lineHeight: 1.3 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: accent, marginBottom: 16 }}>?</div>
            <Rich text={scene.problem} />
          </Appear>
          <Appear
            at={Math.round(dur * 0.4)}
            style={{ ...card, marginTop: 30, borderColor: accent, fontSize: fit(scene.solution.length, 54, 80, 40), lineHeight: 1.3 }}
          >
            <div style={{ fontSize: 34, fontWeight: 800, color: accent, marginBottom: 16 }}>✓</div>
            <Rich text={scene.solution} />
          </Appear>
        </>
      );
      break;

    case "summary":
      body = (
        <div style={{ textAlign: "center" }}>
          <Appear
            at={0}
            style={{
              width: 170,
              height: 170,
              borderRadius: "50%",
              background: accent,
              color: "#0a0b14",
              fontSize: 110,
              fontWeight: 900,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 60px",
            }}
          >
            ✓
          </Appear>
          <Appear at={10} style={{ fontSize: fit(scene.text.length, 84, 60, 58), fontWeight: 800, lineHeight: 1.15 }}>
            <Rich text={scene.text} />
          </Appear>
        </div>
      );
      break;
  }

  return (
    <AbsoluteFill style={{ padding: "270px 80px 620px", justifyContent: "center", fontFamily: FONT, color: "#fff" }}>
      {body}
    </AbsoluteFill>
  );
};
