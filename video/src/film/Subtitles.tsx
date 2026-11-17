import React from "react";
import { useCurrentFrame } from "remotion";
import subs from "../subtitles.json";
import timing from "../timing.json";

type Sub = { start: number; end: number; text: string };

// 这两段画面上本来就是大字文案，再叠字幕是重复
const SKIP = ["hook", "close"];

/**
 * 硬字幕：按配音真实起止帧显示当前这一句。
 *
 * 不加底板 —— 用户明确要求字幕后面不要黑条。
 * 改为「白字 + 深色描边 + 轻微投影」：笔画边缘和底色拉开对比，
 * 在浅色页与深色页上都能读，且不像色块那样压画面。
 */
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();

  // 深底块用白字，浅底块用深墨字——同一条字幕在两种背景上都要够黑/够白
  const DARK_BLOCKS = ["hook", "evidence", "close"];
  let cursor = 0;
  let onDark = false;
  for (const b of timing.blocks as { id: string; frames: number }[]) {
    if (frame >= cursor && frame < cursor + b.frames) {
      if (SKIP.includes(b.id)) {
        return null;
      }
      onDark = DARK_BLOCKS.includes(b.id);
      break;
    }
    cursor += b.frames;
  }

  const list = subs as Sub[];
  const cur = list.find((s) => frame >= s.start && frame < s.end);
  if (!cur) {
    return null;
  }

  // 按用户要求：白字、不描边、只加一点点阴影
  const outline = "0 0 14px rgba(6,18,30,.62), 0 3px 8px rgba(6,18,30,.72), 0 1px 3px rgba(6,18,30,.8)";

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 58,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          color: "#ffffff",
          fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
          fontSize: 42,
          fontWeight: 800,
          lineHeight: 1.42,
          textAlign: "center",
          letterSpacing: 0.5,
          textShadow: outline,
        }}
      >
        {cur.text}
      </div>
    </div>
  );
};
