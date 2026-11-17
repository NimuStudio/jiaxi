import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn } from "../ui";
import { blockById, lineStart } from "../schedule";

const CAPS = ["看家族史", "记发病年龄", "结果可复算", "每条可回查原话", "拆出「可回收」", "数据不出机器"];
const COLS = ["体检解读 App", "医院问卷", "临床家系图", "通用健康 App"];
const MATRIX = [
  [0, 0.5, 1, 0.5],
  [0, 0, 1, 0],
  [0, 0, 0.5, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 1, 1, 0],
];

const PRIVACY: [string, string][] = [
  ["100% 本机推理", "llama-server 跑在 127.0.0.1"],
  ["数据不出机器", "家系与体检数字只在本机 MySQL"],
  ["断网可演示", "拔掉网线，演示照常"],
];

const COL_W = 200;
const LABEL_W = 300;

/**
 * 价值与合规：横向排三条隐私承诺，纵向排一张「四类做法 × 六项能力」矩阵。
 *
 * 上一版右侧用 flex/grid 嵌套，整块渲染不出来（只有末尾说明文字可见），
 * 这里改成不用布局系统的定宽块，先保证「画得出来」再谈好看。
 */
export const Value: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("value");
  const cell = (v: number) => (v === 1 ? "✓" : v === 0.5 ? "△" : "✕");

  return (
    <Stage eyebrow="价值与合规" eyebrowColor={HUES.value} bg={C.bg} padTop={84}>
      <Tag text="05 价值与落地" color={HUES.value} opacity={0.9} />
      <H size={62}>隐私写进代码，<span style={{ color: HUES.value }}>差异化写进对照表</span></H>

      {/* 三条隐私承诺：横排 */}
      <div style={{ display: "flex", gap: 28, marginTop: 26 }}>
        {PRIVACY.map(([t, d], i) => (
          <div
            key={t}
            style={{
              width: 480,
              opacity: fadeIn(frame, 10 + i * 10, 14),
              borderTop: "4px solid " + HUES.value,
              paddingTop: 12,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: HUES.value }}>{t}</div>
            <Sub size={22} delay={0} style={{ marginTop: 4 }}>{d}</Sub>
          </div>
        ))}
      </div>

      {/* 矩阵：定宽行，逐行绘制 */}
      <div style={{ marginTop: 34, opacity: fadeIn(frame, lineStart(b, 1), 16) }}>
        <div style={{ display: "flex", borderBottom: "2px solid " + HUES.value, paddingBottom: 8, fontSize: 21, color: C.muted }}>
          <div style={{ width: LABEL_W }}>能力 / 做法</div>
          {COLS.map((c) => (
            <div key={c} style={{ width: COL_W, textAlign: "center" }}>{c}</div>
          ))}
        </div>

        {CAPS.map((cap, ri) => (
          <div
            key={cap}
            style={{
              display: "flex",
              alignItems: "center",
              height: 56,
              fontSize: 23,
              borderBottom: "1px solid " + C.line,
              background: ri % 2 === 0 ? "rgba(247,251,254,.95)" : "transparent",
            }}
          >
            <div style={{ width: LABEL_W, color: C.text, fontWeight: 600 }}>{cap}</div>
            {MATRIX[ri].map((v, ci) => (
              <div
                key={ci}
                style={{
                  width: COL_W,
                  textAlign: "center",
                  color: v === 1 ? HUES.value : C.faint,
                  fontWeight: v === 1 ? 800 : 400,
                  fontSize: 26,
                }}
              >
                {cell(v)}
              </div>
            ))}
          </div>
        ))}

        <div style={{ marginTop: 16, fontSize: 27, fontWeight: 700 }}>
          四类做法平均 <span style={{ color: C.danger }}>1.1</span> 项，我们{" "}
          <span style={{ color: HUES.value, fontSize: 33 }}>6</span> 项
        </div>
        <Sub size={23} delay={0} style={{ marginTop: 6 }}>
          缺的从来不是 AI，是把家系当成数据处理。
        </Sub>
      </div>
    </Stage>
  );
};
