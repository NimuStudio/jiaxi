import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 出现：位移 + 透明度，p 为 0→1 的进度。 */
export const rise = (p: number, dist = 24) => ({
  opacity: p,
  transform: "translateY(" + (1 - p) * dist + "px)",
});

export const fadeIn = (frame: number, at: number, dur = 14) =>
  interpolate(frame, [at, at + dur], [0, 1], clamp);

/**
 * 动态排版：标题/正文/等宽文本默认带弹簧入场。
 *
 * 之前每页都是「静止画面 + 淡入」，观感像 PPT；把动效做进基础组件后，
 * 全片 15 个块一次性获得关键帧排版，不必逐页手改。
 */
const usePop = (delay: number, dist: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 190, mass: 0.6 }, durationInFrames: 20 });
  return {
    opacity: interpolate(s, [0, 1], [0, 1], clamp),
    transform: "translateY(" + interpolate(s, [0, 1], [dist, 0], clamp) + "px)",
    filter: "blur(" + interpolate(s, [0, 0.6], [4, 0], clamp) + "px)",
  } as React.CSSProperties;
};

export const Stage: React.FC<{
  children: React.ReactNode;
  bg?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  padTop?: number;
}> = ({ children, bg = C.bg, eyebrow, eyebrowColor = C.primary, padTop = 96 }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: bg,
      fontFamily: FONT,
      color: C.text,
      padding: padTop + "px 120px",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {eyebrow ? (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 28,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 1,
          color: eyebrowColor,
        }}
      >
        <span style={{ width: 26, height: 6, background: eyebrowColor, display: "inline-block" }} />
        {eyebrow}
      </div>
    ) : null}
    {children}
  </div>
);

export const H: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 84, color = C.text, delay = 0, style }) => {
  const pop = usePop(delay, 34);
  return (
    <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.22, letterSpacing: -1, color, ...pop, ...style }}>
      {children}
    </div>
  );
};

export const Sub: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 38, color = C.muted, delay = 6, style }) => {
  const pop = usePop(delay, 20);
  return (
    <div style={{ fontSize: size, lineHeight: 1.5, color, ...pop, ...style }}>{children}</div>
  );
};

export const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, size = 28, color = C.text, delay = 0, style }) => {
  const pop = usePop(delay, 12);
  return <div style={{ fontFamily: MONO, fontSize: size, lineHeight: 1.6, color, ...pop, ...style }}>{children}</div>;
};

/** 右上角的章节标签（与答辩稿的页头胶囊同一语言）。 */
export const Tag: React.FC<{ text: string; color: string; opacity?: number }> = ({ text, color, opacity = 1 }) => {
  const pop = usePop(0, -18);
  return (
    <div
      style={{
        position: "absolute",
        top: 62,
        right: 120,
        padding: "10px 22px",
        borderRadius: 999,
        background: color,
        color: "#fff",
        fontSize: 24,
        fontWeight: 700,
        opacity,
        ...pop,
      }}
    >
      {text}
    </div>
  );
};

/** 打字机：按帧推进可见字数。 */
export const typed = (text: string, frame: number, start: number, cps = 16) => {
  const n = Math.max(0, Math.floor(((frame - start) / 30) * cps));
  return text.slice(0, Math.min(text.length, n));
};

export const useFrame = useCurrentFrame;
