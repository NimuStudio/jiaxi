import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, rise, fadeIn } from "../ui";
import { blockById } from "../schedule";

const SENTENCES = [
  "我爸 52 岁放了支架，",
  "爷爷糖尿病，",
  "外公是脑溢血走的。",
];

/** 开场：三句话像听写一样逐句落下来，最后化成一枚「未见异常」的章。 */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("hook");
  // 三句话必须在第一句解说（5.6s）里说完 —— 之前按块时长三等分，
  // 结果解说已经说到外公，画面还停在「我爸放了支架」。
  const step = Math.floor(b.lines[0].frames / SENTENCES.length);

  return (
    <Stage bg={C.ink} padTop={0} eyebrow="">
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 160px" }}>
        {SENTENCES.map((s, i) => {
          const at = i * step;
          const p = fadeIn(frame, at, 18);
          const out = i === SENTENCES.length - 1 ? fadeIn(frame, b.frames - 45, 20) : 0;
          return (
            <div
              key={s}
              style={{
                ...rise(p, 26),
                opacity: p * (1 - out),
                fontSize: 76,
                fontWeight: 700,
                lineHeight: 1.42,
                color: "#fff",
                marginBottom: 10,
              }}
            >
              <span style={{ color: HUES.background, marginRight: 18 }}>「</span>
              {s}
              {i === SENTENCES.length - 1 ? <span style={{ color: HUES.background, marginLeft: 8 }}>」</span> : null}
            </div>
          );
        })}

        {/* 报告卡片：最后 1 秒浮出来，红章「未见异常」 */}
        {(() => {
          const at = b.lines[1].frames > 0 ? b.lines[0].frames + 8 : b.frames - 40;
          const p = fadeIn(frame, at, 20);
          return (
            <div
              style={{
                ...rise(p, 30),
                marginTop: 54,
                width: 760,
                background: "#fff",
                borderRadius: 18,
                padding: "30px 36px",
                boxShadow: "0 26px 60px rgba(0,0,0,.35)",
                position: "relative",
                opacity: p,
              }}
            >
              <div style={{ fontSize: 26, color: C.faint, letterSpacing: 2 }}>年度体检报告 · 血常规 / 生化</div>
              <div style={{ fontSize: 44, fontWeight: 800, marginTop: 12, color: C.text }}>未见异常</div>
              <div
                style={{
                  position: "absolute",
                  right: 28,
                  top: 30,
                  border: "3px solid " + C.danger,
                  color: C.danger,
                  fontSize: 24,
                  fontWeight: 800,
                  padding: "6px 14px",
                  borderRadius: 8,
                  transform: "rotate(-8deg)",
                  opacity: fadeIn(frame, at + 12, 14),
                }}
              >
                无家族史项
              </div>
            </div>
          );
        })()}
      </div>
    </Stage>
  );
};
