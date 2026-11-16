import React from "react";
import { useCurrentFrame } from "remotion";
import subs from "../subtitles.json";
import timing from "../timing.json";

// 这两段画面上本来就是大字文案，再叠字幕是重复
const SKIP = ["hook", "close"];

type Sub = { start: number; end: number; text: string };

/**
 * 硬字幕：按配音真实起止帧显示当前这一句。
 * 白字 + 半透明深色底板——因为片子里深色段（开场/证据/收尾）和浅色段交替，
 * 只靠一种文字色在另一侧会读不清。
 */
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();

  let cursor = 0;
  for (const b of timing.blocks as { id: string; frames: number }[]) {
    if (SKIP.includes(b.id) && frame >= cursor && frame < cursor + b.frames) {
      return null;
    }
    cursor += b.frames;
  }

  const list = subs as Sub[];
  const cur = list.find((s) => frame >= s.start && frame < s.end);
  if (!cur) {
    return null;
  }
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 54,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1420,
          background: "rgba(9,22,34,.62)",
          color: "#ffffff",
          fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
          fontSize: 40,
          lineHeight: 1.42,
          padding: "14px 26px",
          borderRadius: 12,
          textAlign: "center",
          letterSpacing: 0.5,
        }}
      >
        {cur.text}
      </div>
    </div>
  );
};
