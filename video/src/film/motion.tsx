import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 运镜：整块内容当作「被拍的东西」，按关键帧推近/平移。
 * 没有它，每页都是静止画面切换，观感就是 PPT。
 * push：0→1 的推进量；pan：[-1,1] 的横向漂移；zoomFrom 起始倍率。
 */
export const Camera: React.FC<{
  children: React.ReactNode;
  push?: number;
  pan?: number;
  zoomFrom?: number;
  blurOut?: boolean;
}> = ({ children, push = 0.045, pan = 0, zoomFrom = 1, blurOut = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], clamp);
  const scale = (zoomFrom + push) - push * p + (1 - zoomFrom);
  const x = pan * interpolate(p, [0, 1], [-18, 18]);

  return (
    <AbsoluteFill
      style={{
        transform: "scale(" + scale + ") translateX(" + x + "px)",
        transformOrigin: "50% 50%",
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * 入场/出场转场：前 0.35s 从 0.94 放大并淡入，最后 0.3s 淡出。
 * 段与段之间如果只是硬切，会显得像切幻灯片。
 */
export const BlockTransition: React.FC<{
  children: React.ReactNode;
  inFrames?: number;
  outFrames?: number;
}> = ({ children, inFrames = 10, outFrames = 9 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = interpolate(frame, [0, inFrames], [0, 1], clamp);
  const b = interpolate(frame, [durationInFrames - outFrames, durationInFrames], [1, 0], clamp);
  const opacity = Math.min(a, b);
  const scale = interpolate(a, [0, 1], [0.955, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity, transform: "scale(" + scale + ")" }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * 关键帧文字：遮罩上滑 + 逐字延迟。
 * 标题直接淡入是「PPT 动画」，从遮罩里推出来才像剪辑。
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  from?: "up" | "left";
  style?: React.CSSProperties;
}> = ({ children, delay = 0, from = "up", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  const p = interpolate(s, [0, 1], [0, 1], clamp);

  return (
    <div style={{ overflow: "hidden", ...style }}>
      <div
        style={{
          transform:
            from === "up"
              ? "translateY(" + (1 - p) * 105 + "%)"
              : "translateX(" + (1 - p) * -60 + "px)",
          opacity: p,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** 数字滚动：从 0 滚到目标值，末尾轻微回弹。 */
export const CountUp: React.FC<{
  to: number;
  decimals?: number;
  suffix?: string;
  startAt?: number;
  durationInFrames?: number;
  style?: React.CSSProperties;
}> = ({ to, decimals = 1, suffix = "", startAt = 0, durationInFrames = 40, style }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [startAt, startAt + durationInFrames], [0, to], clamp);
  return (
    <span style={style}>
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/** 光带扫过：段落开头扫一下，给「开机/换场」的感觉。 */
export const Sweep: React.FC<{ at?: number; dur?: number; color?: string }> = ({
  at = 0,
  dur = 26,
  color = "#9fd8ff",
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [-0.4, 1.4], clamp);
  if (p <= -0.3 || p >= 1.4) {
    return null;
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "26%",
          left: p * 100 + "%",
          background:
            "linear-gradient(100deg, rgba(255,255,255,0) 0%, " + color + "22 45%, rgba(255,255,255,0) 100%)",
          transform: "skewX(-12deg)",
          filter: "blur(2px)",
        }}
      />
    </AbsoluteFill>
  );
};

/** 质感层：细网格 + 暗角。压在所有内容之上，让纯色底不「塑料」。 */
export const Grain: React.FC<{ strength?: number; grid?: boolean }> = ({
  strength = 0.05,
  grid = true,
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {grid ? (
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,42,68,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,42,68,.055) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(120% 90% at 50% 40%, #000 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 40%, #000 40%, transparent 100%)",
        }}
      />
    ) : null}
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(130% 110% at 50% 45%, rgba(0,0,0,0) 55%, rgba(6,18,30," + strength * 4 + ") 100%)",
      }}
    />
  </AbsoluteFill>
);
