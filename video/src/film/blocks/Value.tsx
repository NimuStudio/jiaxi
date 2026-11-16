import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn, rise } from "../ui";
import { blockById, lineStart } from "../schedule";

const CAPS = ["看家族史", "记发病年龄", "结果可复算", "每条可回查原话", "拆出「可回收」", "数据不出机器"];
const COLS = ["体检解读 App", "医院问卷", "临床家系图", "通用健康 App"];
// 1 = 具备，0.5 = 部分，0 = 不具备
const MATRIX = [
  [0, 0.5, 1, 0.5],
  [0, 0, 1, 0],
  [0, 0, 0.5, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 1, 1, 0],
];

/** value：隐私与合规 + 差异化矩阵（这一段解说讲的是合规与「缺的不是 AI」）。 */
export const Value: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("value");

  const privacy = [
    ["100% 本机推理", "llama-server 跑在 127.0.0.1，代码里没有外部 API 调用"],
    ["数据不出机器", "家系与体检数字只在本机 MySQL；图片只在内存里转 base64"],
    ["断网可演示", "拔掉网线，演示照常；硬盘里的家系一条不少"],
  ];

  return (
    <Stage eyebrow="价值与合规" eyebrowColor={HUES.value} bg={C.bg} padTop={84}>
      <Tag text="05 价值与落地" color={HUES.value} opacity={0.9} />
      <H size={64}>隐私写进代码，<span style={{ color: HUES.value }}>差异化写进对照表</span></H>

      <div style={{ display: "flex", gap: 40, marginTop: 34 }}>
        {/* 左：隐私三条 */}
        <div style={{ width: 620 }}>
          {privacy.map(([t, d], i) => {
            const p = fadeIn(frame, 10 + i * 12, 14);
            return (
              <div key={t} style={{ ...rise(p, 10), opacity: p, borderTop: i === 0 ? "none" : "1px solid " + C.line, padding: "16px 0" }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: HUES.value }}>{t}</div>
                <Sub size={23} style={{ marginTop: 6 }}>{d}</Sub>
              </div>
            );
          })}
        </div>

        {/* 右：矩阵（四类做法 × 六项能力） */}
        <div style={{ flex: 1, opacity: fadeIn(frame, lineStart(b, 1), 16) }}>
          <div style={{ display: "flex", fontSize: 20, color: C.muted, paddingBottom: 8, borderBottom: "2px solid " + HUES.value }}>
            <div style={{ width: 250 }}>能力 / 做法</div>
            {COLS.map((c) => (
              <div key={c} style={{ flex: 1, textAlign: "center" }}>{c}</div>
            ))}
          </div>
          {CAPS.map((cap, ri) => (
            <div
              key={cap}
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 22,
                padding: "9px 0",
                background: ri % 2 === 0 ? "#f7fbfe" : "transparent",
              }}
            >
              <div style={{ width: 250, color: C.text }}>{cap}</div>
              {MATRIX[ri].map((v, ci) => (
                <div key={ci} style={{ flex: 1, textAlign: "center", color: v === 1 ? HUES.value : C.faint, fontWeight: v === 1 ? 800 : 400 }}>
                  {v === 1 ? "✓" : v === 0.5 ? "△" : "✕"}
                </div>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 14, fontSize: 26, fontWeight: 700 }}>
            四类做法平均 <span style={{ color: C.danger }}>1.1</span> 项，我们 <span style={{ color: HUES.value }}>6</span> 项
          </div>
          <Sub size={23} style={{ marginTop: 6 }}>缺的从来不是 AI，是把家系当成数据结构来处理。</Sub>
        </div>
      </div>
    </Stage>
  );
};
