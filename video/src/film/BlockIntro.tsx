import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, HUES } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 章节冲击卡：每块开头 0.4 秒全屏大字。
 *
 * 之前全片是一条平线——15 个块都是「标题 + 内容」，没有呼吸；
 * 这一层把每块切出一个短促的重音，观众能感觉到「换段了」。
 * 它盖在内容之上，所以不改变任何块的排版。
 */
export const BlockIntro: React.FC<{ text: string; accent: string; frames?: number }> = ({
  text,
  accent,
  frames = 14,
}) => {
  const frame = useCurrentFrame();
  if (frame >= frames) {
    return null;
  }
  const enter = interpolate(frame, [0, 5], [0, 1], clamp);
  const exit = interpolate(frame, [frames - 6, frames], [1, 0], clamp);
  const y = Math.round(interpolate(enter, [0, 1], [46, 0], clamp));

  return (
    <AbsoluteFill style={{ opacity: Math.min(enter, exit), pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(120deg, " + accent + " 0%, " + C.ink + " 92%)" }} />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 140px",
          transform: "translate3d(0," + y + "px,0)",
        }}
      >
        <div style={{ width: 120, height: 10, background: "rgba(255,255,255,.85)", marginBottom: 26 }} />
        <div
          style={{
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: -1,
            color: "#fff",
            lineHeight: 1.1,
            fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
          }}
        >
          {text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 每块的强调色与冲击卡文案（文案取 timing 里的块标题）。 */
export const INTRO_ACCENT: Record<string, string> = {
  hook: HUES.background,
  problem: HUES.background,
  whatwedo: HUES.background,
  demo1: HUES.product,
  demo2: HUES.value,
  demo3: HUES.value,
  ai1: HUES.accuracy,
  ai2: HUES.accuracy,
  ai3: HUES.accuracy,
  arch: HUES.tech,
  deploy: HUES.value,
  evidence: HUES.value,
  value: HUES.value,
  team: HUES.team,
  close: HUES.team,
};
