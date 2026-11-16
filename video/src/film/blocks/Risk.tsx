import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn, rise } from "../ui";
import { blockById, lineStart } from "../schedule";

const ENGINES = [
  ["FINDRISC", "糖代谢", "0–26 分 · 五档"],
  ["China-PAR", "心血管 10 年", "ASCVD % + 分层"],
  ["PLCOm2012", "肺癌 6 年", "风险 % + 筛查阈值"],
];

/** 风险：按四句话逐层推进——引擎 → 变量 → 尺子 → 拆成两列。 */
export const Risk: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("risk");
  const a0 = lineStart(b, 0);
  const a1 = lineStart(b, 1);
  const a2 = lineStart(b, 2);
  const a3 = lineStart(b, 3);

  const scale = (at: number, dur: number) =>
    interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const k1 = scale(a2, 40);
  const k2 = scale(a3 - 10, 46);
  const now = 33 * (1 - 0.5 * k1) * (1 - 0.76 * k2);
  const FULL = 1180;

  return (
    <Stage eyebrow="可回收" eyebrowColor={HUES.value} bg={C.bg}>
      <Tag text="05 价值与落地" color={HUES.value} opacity={0.9} />
      <H size={78}>
        不给你一个笼统的「高风险」，<span style={{ color: HUES.value }}>先拆开算</span>
      </H>

      {/* 第 1 句：三套引擎 */}
      <div style={{ display: "flex", gap: 24, marginTop: 34 }}>
        {ENGINES.map(([name, what, out], i) => {
          const p = fadeIn(frame, a0 + i * 10, 16);
          return (
            <div
              key={name}
              style={{
                ...rise(p, 16),
                opacity: p,
                width: 372,
                background: "#fff",
                border: "1px solid " + C.line,
                borderRadius: 14,
                padding: "18px 22px",
              }}
            >
              <div style={{ fontSize: 27, fontWeight: 800, color: C.primary }}>{name}</div>
              <div style={{ fontSize: 22, color: C.muted, marginTop: 6 }}>{what}</div>
              <div style={{ fontSize: 20, color: HUES.value, marginTop: 8 }}>{out}</div>
            </div>
          );
        })}
      </div>

      {/* 第 2 句：家族史是方程里的变量 */}
      <div
        style={{
          marginTop: 26,
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 20px",
          borderRadius: 10,
          background: HUES.value + "14",
          opacity: fadeIn(frame, a1, 16),
        }}
      >
        <span style={{ fontSize: 26, color: HUES.value, fontWeight: 800 }}>家族史</span>
        <span style={{ fontSize: 24, color: C.muted }}>在每一套引擎里都是方程里的一个变量，不是一个开关</span>
      </div>

      {/* 第 3 句：尺子 */}
      <div style={{ marginTop: 30, opacity: fadeIn(frame, a2 - 6, 14) }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <div style={{ fontSize: 138, fontWeight: 800, lineHeight: 1, color: now < 10 ? HUES.value : C.text }}>
            {now.toFixed(1)}%
          </div>
          <div style={{ fontSize: 28, color: C.muted, paddingBottom: 22 }}>现在的风险 · FINDRISC</div>
        </div>

        <div style={{ position: "relative", height: 32, width: FULL, background: "#e8eef6", borderRadius: 999, marginTop: 24 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: 32, width: (FULL * 33) / 100, background: C.lineStrong, borderRadius: 999 }} />
          <div style={{ position: "absolute", left: 0, top: 0, height: 32, width: ((FULL * 16.5) / 100) * k1, background: HUES.value, borderRadius: 999 }} />
          <div style={{ position: "absolute", left: (FULL * now) / 100 - 11, top: -9, width: 22, height: 50, borderRadius: 8, background: HUES.value }} />
        </div>
        <div style={{ position: "relative", width: FULL, height: 30, fontSize: 22, color: C.faint, marginTop: 10 }}>
          <span style={{ position: "absolute", left: 0 }}>0%</span>
          <span style={{ position: "absolute", left: (FULL * 4) / 33 - 18 }}>4% 全部达标后</span>
          <span style={{ position: "absolute", right: 0 }}>33% 现在</span>
        </div>
      </div>

      {/* 尺子出现后的过渡：先用一行汇总占住下半屏 */}
      <div style={{ marginTop: 22, opacity: fadeIn(frame, a2 + 24, 14) * (1 - fadeIn(frame, a3 - 6, 12)) }}>
        <span style={{ fontSize: 30, color: C.muted }}>
          这 33 分里，<span style={{ color: HUES.value, fontWeight: 800 }}>7 分能改</span>，
          <span style={{ color: C.text, fontWeight: 800 }}>9 分改不了</span>
        </span>
      </div>

      {/* 第 4 句：拆成能改 / 改不了 */}
      <div style={{ display: "flex", gap: 40, marginTop: 26, opacity: fadeIn(frame, a3, 16) }}>
        {[
          { t: "能改的 7 分", items: ["BMI", "腰围", "体力活动", "蔬果摄入"], color: HUES.value },
          { t: "改不了的 9 分", items: ["年龄", "家族史", "正在服用的降压药"], color: C.muted },
        ].map((col) => (
          <div key={col.t} style={{ flex: 1, borderTop: "4px solid " + col.color, paddingTop: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: col.color }}>{col.t}</div>
            <div style={{ fontSize: 25, color: C.muted, marginTop: 8 }}>{col.items.join(" · ")}</div>
          </div>
        ))}
      </div>
    </Stage>
  );
};
