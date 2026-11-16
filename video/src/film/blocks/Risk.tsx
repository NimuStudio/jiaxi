import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn } from "../ui";
import { blockById, lineStart } from "../schedule";

/** 风险尺：33% → 17% → 4%，橙色（能改的）被逐段吃掉。 */
export const Risk: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("risk");
  const a1 = lineStart(b, 2);
  const a2 = lineStart(b, 3);

  const scale = (at: number, dur: number) => interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // 33% → 17% → 4%
  const k1 = scale(a1, 40);
  const k2 = scale(a2, 46);
  const now = 33 * (1 - 0.5 * k1) * (1 - 0.76 * k2);

  const FULL = 1180;

  return (
    <Stage eyebrow="可回收" eyebrowColor={HUES.value} bg={C.bg}>
      <Tag text="05 价值与落地" color={HUES.value} opacity={0.9} />
      <H>
        不给你一个笼统的「高风险」，<span style={{ color: HUES.value }}>先拆开算</span>
      </H>
      <Sub style={{ marginTop: 14 }}>家族史在每一套引擎里都是方程里的一个变量，不是一个开关</Sub>

      <div style={{ marginTop: 76 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 26 }}>
          <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, color: now < 10 ? HUES.value : C.text }}>
            {now.toFixed(1)}%
          </div>
          <div style={{ fontSize: 30, color: C.muted, paddingBottom: 24 }}>现在的风险 · FINDRISC</div>
        </div>

        {/* 尺子：灰底 + 橙色「能改的」段 + 端点刻度 */}
        <div style={{ position: "relative", height: 34, width: FULL, background: "#e8eef6", borderRadius: 999, marginTop: 30 }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: 34, width: (FULL * 33) / 100, background: C.lineStrong, borderRadius: 999 }} />
          <div style={{ position: "absolute", left: 0, top: 0, height: 34, width: (FULL * (33 * 0.5)) / 100 * k1, background: HUES.value, borderRadius: 999 }} />
          <div style={{ position: "absolute", left: (FULL * now) / 100 - 12, top: -10, width: 24, height: 54, borderRadius: 8, background: HUES.value, opacity: fadeIn(frame, a1, 12) }} />
        </div>
        {/* 刻度按比例定位：尺子满宽 = 33%，4% 就该落在 4/33 处 */}
        <div style={{ position: "relative", width: FULL, height: 34, fontSize: 23, color: C.faint, marginTop: 12 }}>
          <span style={{ position: "absolute", left: 0 }}>0%</span>
          <span style={{ position: "absolute", left: (FULL * 4) / 33 - 20 }}>4% 全部达标后</span>
          <span style={{ position: "absolute", right: 0 }}>33% 现在</span>
        </div>
      </div>

      {/* 能改 / 改不了 */}
      <div style={{ display: "flex", gap: 40, marginTop: 64, opacity: fadeIn(frame, a2 + 20, 18) }}>
        {[
          { t: "能改的 7 分", items: ["BMI", "腰围", "体力活动", "蔬果摄入"], color: HUES.value },
          { t: "改不了的 9 分", items: ["年龄", "家族史", "正在服用的降压药"], color: C.muted },
        ].map((col) => (
          <div key={col.t} style={{ flex: 1, borderTop: "4px solid " + col.color, paddingTop: 18 }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: col.color }}>{col.t}</div>
            <div style={{ fontSize: 27, color: C.muted, marginTop: 10, lineHeight: 1.7 }}>{col.items.join(" · ")}</div>
          </div>
        ))}
      </div>
    </Stage>
  );
};
