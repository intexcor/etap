import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// ============================================================
// "Почему небо голубое?" — образовательный TikTok-ролик
// Формат: 1080x1920 (9:16), 30fps, ~25 секунд (750 кадров)
// Быстрый монтаж: 7 сцен со сменой каждые 3-4 секунды
// ============================================================

export const FPS = 30;
export const DURATION_IN_FRAMES = 750; // 25 секунд

// -------------------- Вспомогательные компоненты --------------------

const BigText: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  y?: number;
}> = ({ children, size = 90, color = "white", y = 0 }) => {
  const frame = useCurrentFrame();
  const scale = spring({
    frame,
    fps: FPS,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
  });
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: `calc(50% + ${y}px)`,
        left: 0,
        right: 0,
        transform: `translateY(-50%) scale(${scale})`,
        opacity,
        textAlign: "center",
        fontFamily: "Arial Black, Helvetica, sans-serif",
        fontWeight: 900,
        fontSize: size,
        color,
        padding: "0 60px",
        lineHeight: 1.15,
        textShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      {children}
    </div>
  );
};

const ProgressDots: React.FC<{ total: number; active: number }> = ({
  total,
  active,
}) => (
  <div
    style={{
      position: "absolute",
      top: 70,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      gap: 10,
    }}
  >
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        style={{
          width: i === active ? 34 : 10,
          height: 10,
          borderRadius: 6,
          background: i === active ? "white" : "rgba(255,255,255,0.35)",
          transition: "none",
        }}
      />
    ))}
  </div>
);

// -------------------- Сцена 1: Хук --------------------

const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const bgShift = interpolate(frame, [0, 90], [0, 40]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${180 + bgShift}deg, #1b2a6b, #3563c9 60%, #6fa8ff)`,
      }}
    >
      <ProgressDots total={7} active={0} />
      <BigText size={100}>
        Почему{"\n"}небо{"\n"}голубое? 🌤
      </BigText>
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(255,255,255,0.85)",
          fontFamily: "Arial, sans-serif",
          fontSize: 34,
          opacity: interpolate(frame, [40, 60], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        объясняю за 25 секунд ⬇️
      </div>
    </AbsoluteFill>
  );
};

// -------------------- Сцена 2: Солнечный свет = все цвета --------------------

const Scene2Spectrum: React.FC = () => {
  const frame = useCurrentFrame();
  const colors = [
    "#ff3b3b",
    "#ff9d3b",
    "#ffe93b",
    "#3bff6a",
    "#3bb8ff",
    "#7d3bff",
  ];

  return (
    <AbsoluteFill style={{ background: "#0c0c14" }}>
      <ProgressDots total={7} active={1} />
      <BigText size={72} y={-420}>
        Солнечный свет —{"\n"}это все цвета сразу
      </BigText>

      <div
        style={{
          position: "absolute",
          top: "52%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 14,
        }}
      >
        {colors.map((c, i) => {
          const delay = i * 5;
          const h = interpolate(frame, [delay, delay + 15], [0, 260], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div
              key={c}
              style={{
                width: 40,
                height: h,
                borderRadius: 20,
                background: c,
                alignSelf: "flex-end",
                boxShadow: `0 0 30px ${c}`,
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 260,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: 30,
          opacity: interpolate(frame, [70, 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        белый свет = спектр радуги внутри
      </div>
    </AbsoluteFill>
  );
};

// -------------------- Сцена 3: Свет входит в атмосферу --------------------

const Scene3Atmosphere: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const beamX = interpolate(frame, [0, 70], [-100, width * 0.55], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const particles = Array.from({ length: 18 });

  return (
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, #050510, #101a3d)" }}
    >
      <ProgressDots total={7} active={2} />
      <BigText size={66} y={-460}>
        Он влетает{"\n"}в атмосферу Земли
      </BigText>

      {/* Молекулы воздуха */}
      {particles.map((_, i) => {
        const px = (width / 18) * i + 20;
        const py = height * 0.6 + Math.sin(i * 1.7) * 120;
        const pulse = interpolate(
          (frame + i * 6) % 40,
          [0, 20, 40],
          [0.6, 1.4, 0.6],
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: 14 * pulse,
              height: 14 * pulse,
              borderRadius: "50%",
              background: "rgba(150,190,255,0.5)",
            }}
          />
        );
      })}

      {/* Луч белого света */}
      <div
        style={{
          position: "absolute",
          top: height * 0.6 - 8,
          left: 0,
          width: Math.max(beamX, 0),
          height: 16,
          borderRadius: 8,
          background: "linear-gradient(90deg, transparent, white)",
          boxShadow: "0 0 40px white",
        }}
      />
    </AbsoluteFill>
  );
};

// -------------------- Сцена 4: Рассеяние (волны) --------------------

const WaveRow: React.FC<{
  label: string;
  color: string;
  wavelength: number;
  scatterStrength: string;
  y: number;
  delay: number;
}> = ({ label, color, wavelength, scatterStrength, y, delay }) => {
  const frame = useCurrentFrame();
  const local = Math.max(frame - delay, 0);
  const opacity = interpolate(local, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const points = Array.from({ length: 40 }).map((_, i) => {
    const x = i * 22;
    const yy = Math.sin((i / wavelength) * Math.PI * 2 + local * 0.3) * 30;
    return `${x},${yy}`;
  });

  return (
    <div style={{ position: "absolute", top: y, left: 60, opacity }}>
      <svg width={880} height={100} style={{ overflow: "visible" }}>
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          transform="translate(0,50)"
        />
      </svg>
      <div
        style={{
          color,
          fontFamily: "Arial, sans-serif",
          fontSize: 30,
          fontWeight: 700,
          marginTop: -10,
        }}
      >
        {label} · рассеивается {scatterStrength}
      </div>
    </div>
  );
};

const Scene4Waves: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0a0a16" }}>
      <ProgressDots total={7} active={3} />
      <BigText size={64} y={-560}>
        Короткие волны{"\n"}рассеиваются сильнее
      </BigText>
      <WaveRow
        label="Красный"
        color="#ff5555"
        wavelength={9}
        scatterStrength="слабо"
        y={780}
        delay={10}
      />
      <WaveRow
        label="Синий"
        color="#4da6ff"
        wavelength={4}
        scatterStrength="в ~5 раз сильнее"
        y={950}
        delay={40}
      />
      <div
        style={{
          position: "absolute",
          bottom: 220,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "rgba(255,255,255,0.8)",
          fontFamily: "Arial, sans-serif",
          fontSize: 28,
          opacity: interpolate(useCurrentFrame(), [80, 100], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        это называется рассеяние Рэлея
      </div>
    </AbsoluteFill>
  );
};

// -------------------- Сцена 5: Небо синее --------------------

const Scene5SkyBlue: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const dots = Array.from({ length: 60 });

  return (
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, #1560c9, #7fc4ff)" }}
    >
      <ProgressDots total={7} active={4} />

      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const r = interpolate(frame, [0, 60], [0, 420], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const cx = width / 2 + Math.cos(angle + i) * r;
        const cy = height * 0.5 + Math.sin(angle + i) * r * 0.6;
        const op = interpolate(frame, [0, 30, 60, 90], [0, 1, 1, 0.3], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#e8f4ff",
              opacity: op,
            }}
          />
        );
      })}

      <BigText size={90} color="white">
        Поэтому небо{"\n"}вокруг — синее! 💙
      </BigText>
    </AbsoluteFill>
  );
};

// -------------------- Сцена 6: Почему закат красный --------------------

const Scene6Sunset: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pathProgress = interpolate(frame, [0, 90], [0.05, 0.95], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  const sunX = width * pathProgress;
  const sunY = height * 0.55 + Math.sin(pathProgress * Math.PI) * -180;
  const sunColor = `rgb(${255}, ${Math.round(220 - pathProgress * 150)}, ${Math.round(140 - pathProgress * 130)})`;

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #ff9d5c, #ff5c5c 60%, #7a2b6b)",
      }}
    >
      <ProgressDots total={7} active={5} />
      <BigText size={62} y={-560}>
        А на закате{"\n"}путь длиннее...
      </BigText>

      <div
        style={{
          position: "absolute",
          left: sunX - 60,
          top: sunY,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: sunColor,
          boxShadow: `0 0 80px ${sunColor}`,
        }}
      />

      <div
        style={{
          position: "absolute",
          bottom: 240,
          left: 0,
          right: 0,
          textAlign: "center",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: 30,
          padding: "0 60px",
          opacity: interpolate(frame, [55, 75], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        синий свет рассеивается по пути и не долетает — остаётся красный
      </div>
    </AbsoluteFill>
  );
};

// -------------------- Сцена 7: Outro --------------------

const Scene7Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 5) * 0.03;

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 40%, #1b2a6b, #050510)",
      }}
    >
      <ProgressDots total={7} active={6} />
      <BigText size={80}>Теперь ты{"\n"}физик неба 🌌</BigText>
      <div
        style={{
          position: "absolute",
          bottom: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          transform: `scale(${pulse})`,
          color: "white",
          fontFamily: "Arial Black, sans-serif",
          fontSize: 40,
          opacity: interpolate(frame, [20, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        подпишись на ещё 🔥
      </div>
    </AbsoluteFill>
  );
};

// -------------------- Главная композиция --------------------

export const WhySkyIsBlue: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Sequence from={0} durationInFrames={90}>
        <Scene1Hook />
      </Sequence>
      <Sequence from={90} durationInFrames={100}>
        <Scene2Spectrum />
      </Sequence>
      <Sequence from={190} durationInFrames={100}>
        <Scene3Atmosphere />
      </Sequence>
      <Sequence from={290} durationInFrames={110}>
        <Scene4Waves />
      </Sequence>
      <Sequence from={400} durationInFrames={100}>
        <Scene5SkyBlue />
      </Sequence>
      <Sequence from={500} durationInFrames={130}>
        <Scene6Sunset />
      </Sequence>
      <Sequence from={630} durationInFrames={120}>
        <Scene7Outro />
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================================
// Как подключить (в стандартном Remotion-проекте):
//
// В src/Root.tsx:
//
// import { Composition } from 'remotion';
// import { WhySkyIsBlue, FPS, DURATION_IN_FRAMES } from './WhySkyIsBlue';
//
// <Composition
//   id="WhySkyIsBlue"
//   component={WhySkyIsBlue}
//   durationInFrames={DURATION_IN_FRAMES}
//   fps={FPS}
//   width={1080}
//   height={1920}
// />
// ============================================================
