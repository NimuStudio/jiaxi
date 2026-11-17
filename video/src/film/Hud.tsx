import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { BLOCKS } from "./schedule";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * HUD：全片的「仪表层」，让画面元素密度上来，并且持续有小幅运动。
 *
 * 四角色标 + 左上章节号 + 右上时间码 + 底部进度条（带 15 个分段刻度）
 * + 右缘逐句圆点。进度条每秒都在走，圆点每句跳一次——
 * 这是「每一秒都有东西在动」里最稳的一层。
 */
export const Hud: React.FC<{ accent: string; dark?: boolean; startFrame?: number }> = ({
  accent,
  dark = false,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const f = frame + startFrame;

  const progress = interpolate(f, [0, durationInFrames], [0, 1], clamp);

  // 当前块与块内句序
  let cursor = 0;
  let idx = 0;
  let lineNow = 0;
  let lineCount = 1;
  for (let i = 0; i < BLOCKS.length; i++) {
    const b = BLOCKS[i];
    if (f >= cursor && f < cursor + b.frames) {
      idx = i;
      lineCount = b.lines.length;
      let c2 = cursor;
      for (let j = 0; j < b.lines.length; j++) {
        if (f >= c2) {
          lineNow = j;
        }
        c2 += b.lines[j].frames;
      }
      break;
    }
    cursor += b.frames;
  }

  // 深色块自动切浅色 HUD，否则深墨字压在深底上等于没有
  const isDark = dark || ["hook", "evidence", "close"].includes(BLOCKS[idx]?.id ?? "") || (BLOCKS[idx]?.id ?? "").startsWith("demo");
  const ink = isDark ? "rgba(255,255,255,.78)" : "rgba(15,42,68,.62)";
  const inkSoft = isDark ? "rgba(255,255,255,.30)" : "rgba(15,42,68,.16)";

  const sec = String(idx + 1).padStart(2, "0");
  const total = String(BLOCKS.length).padStart(2, "0");
  const t = f / fps;
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = String(Math.floor(t % 60)).padStart(2, "0");
  const ff = String(Math.floor(f % fps)).padStart(2, "0");

  const bracket = (style: React.CSSProperties) => (
    <div style={{ position: "absolute", width: 46, height: 46, borderColor: ink, ...style }} />
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 5 }}>
      {/* 四角色标 */}
      {bracket({ left: 40, top: 40, borderLeft: "2px solid", borderTop: "2px solid" })}
      {bracket({ right: 40, top: 40, borderRight: "2px solid", borderTop: "2px solid" })}
      {bracket({ left: 40, bottom: 44, borderLeft: "2px solid", borderBottom: "2px solid" })}
      {bracket({ right: 40, bottom: 44, borderRight: "2px solid", borderBottom: "2px solid" })}

      {/* 左上：章节号 */}
      <div
        style={{
          position: "absolute",
          left: 56,
          top: 52,
          fontFamily: '"Consolas", monospace',
          fontSize: 22,
          letterSpacing: 2,
          color: ink,
        }}
      >
        SEC {sec}/{total}
      </div>

      {/* 右上：时间码 */}
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 52,
          fontFamily: '"Consolas", monospace',
          fontSize: 22,
          letterSpacing: 1,
          color: ink,
        }}
      >
        {mm}:{ss}:{ff}
      </div>

      {/* 右缘：逐句圆点 */}
      <div
        style={{
          position: "absolute",
          right: 58,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {new Array(lineCount).fill(0).map((_, i) => {
          const active = i === lineNow;
          return (
            <div
              key={i}
              style={{
                width: active ? 12 : 7,
                height: active ? 12 : 7,
                borderRadius: 6,
                background: active ? accent : inkSoft,
                transition: "none",
              }}
            />
          );
        })}
      </div>

      {/* 底部进度条 + 分段刻度 */}
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 20, height: 5, background: inkSoft, borderRadius: 3 }}>
        <div style={{ width: progress * 100 + "%", height: "100%", background: accent, borderRadius: 3 }} />
        {BLOCKS.map((b, i) => {
          const at = BLOCKS.slice(0, i).reduce((s, x) => s + x.frames, 0) / durationInFrames;
          return (
            <div
              key={b.id}
              style={{
                position: "absolute",
                left: at * 100 + "%",
                top: -3,
                width: 2,
                height: 11,
                background: inkSoft,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const HUD_DARK = (blockId: string) => ["hook", "evidence", "close"].includes(blockId) || blockId.startsWith("demo");
export const HUD_C = C;
