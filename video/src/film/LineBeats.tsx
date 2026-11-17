import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 每句解说开始时的画面动作（不使用「一束光扫过去」）。
 *
 * 换成：两侧的圆环脉冲 + 一个简短的编号牌从右下弹出。
 * 两者都只在局部变化，不会横穿整幅画面，也不会压到文字。
 */
export const LineBeat: React.FC<{ accent: string; frames?: number; index?: number }> = ({
  accent,
  frames = 20,
  index = 0,
}) => {
  const frame = useCurrentFrame();
  if (frame >= frames) {
    return null;
  }
  const p = interpolate(frame, [0, frames], [0, 1], clamp);
  const ringScale = interpolate(p, [0, 1], [0.6, 1.5], clamp);
  const ringOpacity = interpolate(p, [0, 0.2, 1], [0, 0.5, 0], clamp);
  const chip = interpolate(p, [0, 0.35, 1], [0, 1, 1], clamp);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          right: 120,
          bottom: 130,
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: "3px solid " + accent,
          opacity: ringOpacity,
          transform: "scale(" + ringScale + ")",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 120,
          width: 80,
          height: 80,
          borderRadius: "50%",
          border: "2px solid " + accent,
          opacity: ringOpacity * 0.7,
          transform: "scale(" + interpolate(p, [0, 1], [0.8, 1.3], clamp) + ")",
        }}
      />
      {/* 编号牌：每句出现一次，轻微弹入 */}
      <div
        style={{
          position: "absolute",
          left: 56,
          bottom: 130,
          padding: "6px 14px",
          borderRadius: 8,
          background: accent,
          color: "#fff",
          fontFamily: '"Consolas", monospace',
          fontSize: 22,
          fontWeight: 700,
          opacity: chip * 0.9,
          transform: "translateY(" + (1 - chip) * 10 + "px)",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
