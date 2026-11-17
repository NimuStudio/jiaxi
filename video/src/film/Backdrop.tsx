import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 背景系统：不再是「一块纯色 + 网格」，而是分层设计。
 *
 * 四层：底渐变 → 两个大色斑（缓慢漂移）→ 几何线框（描边圆/弧）→ 网格与暗角。
 * 色斑按帧缓慢位移，与前景形成视差；这是「有画面」和「像 PPT」的分界。
 * 全部是 CSS 渐变，不引入图片，渲染快且不会糊。
 */
export const Backdrop: React.FC<{
  accent?: string;
  variant?: "light" | "dark" | "warm";
  seed?: number;
}> = ({ accent = C.primary, variant = "light", seed = 0 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], clamp);

  const base =
    variant === "dark"
      ? "radial-gradient(120% 120% at 78% 12%, #17395c 0%, " + C.ink + " 58%, #060f18 100%)"
      : variant === "warm"
      ? "linear-gradient(150deg, #fdf7ee 0%, #fbf2e6 46%, #f4ece1 100%)"
      : "linear-gradient(150deg, #f7fbff 0%, " + C.bg + " 48%, #e9f1fa 100%)";

  const blobAlpha = variant === "dark" ? 0.30 : 0.16;
  const drift1 = 6 * Math.sin((seed + p * 2) * Math.PI);
  const drift2 = 8 * Math.cos((seed + p * 2) * Math.PI);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: base }}>
      {/* 大色斑：缓慢漂移 */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          left: -260 + drift1 * 3,
          top: -420 + drift1 * 2,
          borderRadius: "50%",
          background: "radial-gradient(circle, " + accent + Math.round(blobAlpha * 255).toString(16).padStart(2, "0") + " 0%, transparent 68%)",
          filter: "blur(28px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 860,
          height: 860,
          right: -220 - drift2 * 2,
          bottom: -300 - drift2 * 2,
          borderRadius: "50%",
          background: "radial-gradient(circle, " + accent + "1f 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      {/* 几何线框：一个描边大圆 + 一段弧，给画面结构 */}
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          right: -180 + drift1,
          top: -140 + drift2 * 0.6,
          borderRadius: "50%",
          border: "2px solid " + accent + (variant === "dark" ? "33" : "22"),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 420,
          height: 420,
          left: 90 + drift2,
          bottom: -180,
          borderRadius: "50%",
          border: "2px solid " + accent + (variant === "dark" ? "22" : "18"),
        }}
      />

      {/* 网格（低对比）+ 暗角 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(" + (variant === "dark" ? "rgba(255,255,255,.05)" : "rgba(15,42,68,.05)") + " 1px, transparent 1px), linear-gradient(90deg, " + (variant === "dark" ? "rgba(255,255,255,.05)" : "rgba(15,42,68,.05)") + " 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(140% 100% at 50% 0%, #000 30%, transparent 92%)",
          WebkitMaskImage: "radial-gradient(140% 100% at 50% 0%, #000 30%, transparent 92%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(130% 110% at 50% 45%, rgba(0,0,0,0) 52%, " +
            (variant === "dark" ? "rgba(0,0,0,.55)" : "rgba(10,32,54,.13)") +
            " 100%)",
        }}
      />
    </div>
  );
};
