import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 每句解说开始时的画面动作。
 *
 * 用户反馈：配音在说话，画面大部分时间是静止的——「PPT 感」的主要来源其实是这个。
 * 每句给一个短促的视觉事件：一圈色环扩散 + 一次轻微提亮。
 * 它盖在内容之上但只做透明度/缩放，不碰文字，所以不会引入文字抖动。
 */
export const LineBeat: React.FC<{ accent: string; frames?: number }> = ({ accent, frames = 20 }) => {
  const frame = useCurrentFrame();
  if (frame >= frames) {
    return null;
  }
  const p = interpolate(frame, [0, frames], [0, 1], clamp);
  // 一道细光带横向扫过：位移小、存在感明确，且不改变底色（全屏提亮会像闪一下）
  const sweepX = interpolate(p, [0, 1], [-30, 100], clamp);
  const sweepOpacity = interpolate(p, [0, 0.15, 0.75, 1], [0, 0.9, 0.9, 0], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* 斜向光带扫过整个画面（不压任何文字，位置安全） */}
      <div
        style={{
          position: "absolute",
          top: -160,
          bottom: -160,
          width: "18%",
          left: sweepX + "%",
          transform: "skewX(-14deg)",
          background:
            "linear-gradient(100deg, rgba(255,255,255,0) 0%, " + accent + "2e 48%, rgba(255,255,255,0) 100%)",
          opacity: sweepOpacity * 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
