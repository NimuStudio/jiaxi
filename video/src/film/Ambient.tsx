import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * 常驻环境层：全片每一帧都在动，与内容无关。
 *
 * 用户的意见是「画面动得太少，希望每一秒都有东西在动」——
 * 内容入场是一次性动画，一旦播完画面就静了；这一层负责兜底：
 *   环形轨道缓慢自转、粒子按正弦轨迹漂移、网格缓慢平移。
 * 全部用 transform/backgroundPosition，不做逐帧重排，性能可控。
 */
export const Ambient: React.FC<{ accent: string; dark?: boolean }> = ({ accent, dark = false }) => {
  const frame = useCurrentFrame();

  const dotCount = 26;
  const dots = new Array(dotCount).fill(0).map((_, i) => {
    const seed = i * 137.5;
    const cx = ((seed % 1920) + frame * (0.35 + (i % 5) * 0.12)) % 1920;
    const cy =
      ((seed * 0.6) % 1080) + Math.sin((frame / 42 + i) * 1.1) * (26 + (i % 4) * 12);
    const size = 3 + (i % 3) * 2;
    const op = 0.10 + (i % 4) * 0.045;
    return { cx, cy, size, op };
  });

  return (
    // zIndex 2：块的 Backdrop 与内容层是 0/1，环境层必须压在其上才看得见
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", zIndex: 2 }}>
      {/* 缓慢自转的虚线轨道 */}
      <div
        style={{
          position: "absolute",
          width: 1180,
          height: 1180,
          left: -260,
          top: -420,
          borderRadius: "50%",
          border: "2px dashed " + accent + (dark ? "2e" : "26"),
          transform: "rotate(" + frame * 0.25 + "deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          right: -300,
          bottom: -380,
          borderRadius: "50%",
          border: "2px dashed " + accent + (dark ? "26" : "1f"),
          transform: "rotate(" + frame * -0.18 + "deg)",
        }}
      />

      {/* 漂移粒子 */}
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.cx,
            top: d.cy,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            background: accent,
            opacity: d.op,
          }}
        />
      ))}

      {/* 网格缓慢平移，制造「镜头在动」的错觉 */}
      <div
        style={{
          position: "absolute",
          inset: -80,
          backgroundImage:
            "linear-gradient(" +
            (dark ? "rgba(255,255,255,.055)" : "rgba(15,42,68,.05)") +
            " 1px, transparent 1px), linear-gradient(90deg, " +
            (dark ? "rgba(255,255,255,.055)" : "rgba(15,42,68,.05)") +
            " 1px, transparent 1px)",
          backgroundSize: "76px 76px",
          backgroundPosition: frame * 0.35 + "px " + frame * 0.22 + "px",
          maskImage: "radial-gradient(140% 100% at 50% 0%, #000 32%, transparent 94%)",
          WebkitMaskImage: "radial-gradient(140% 100% at 50% 0%, #000 32%, transparent 94%)",
        }}
      />
    </AbsoluteFill>
  );
};
