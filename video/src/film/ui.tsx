import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";

/** 出现：位移 + 透明度，p 为 0→1 的进度。 */
export const rise = (p: number, dist = 24) => ({
  opacity: p,
  transform: "translateY(" + (1 - p) * dist + "px)",
});

export const fadeIn = (frame: number, at: number, dur = 14) =>
  interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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

export const H: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  size = 84,
  color = C.text,
  style,
}) => (
  <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.22, letterSpacing: -1, color, ...style }}>
    {children}
  </div>
);

export const Sub: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  size = 38,
  color = C.muted,
  style,
}) => <div style={{ fontSize: size, lineHeight: 1.5, color, ...style }}>{children}</div>;

export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  size = 28,
  color = C.text,
  style,
}) => <div style={{ fontFamily: MONO, fontSize: size, lineHeight: 1.6, color, ...style }}>{children}</div>;

/** 右上角的章节标签（与答辩稿的页头胶囊同一语言）。 */
export const Tag: React.FC<{ text: string; color: string; opacity?: number }> = ({ text, color, opacity = 1 }) => (
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
    }}
  >
    {text}
  </div>
);

/** 打字机：按帧推进可见字数。 */
export const typed = (text: string, frame: number, start: number, cps = 16) => {
  const n = Math.max(0, Math.floor(((frame - start) / 30) * cps));
  return text.slice(0, Math.min(text.length, n));
};

export const useFrame = useCurrentFrame;
