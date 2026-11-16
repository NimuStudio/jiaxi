import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, rise, fadeIn } from "../ui";
import { blockById, lineStart } from "../schedule";

const ROWS = [
  {
    n: "01",
    claim: "体检报告只解读当次指标",
    lost: "「未见异常」四个字，不看亲属的病史与发病年龄",
  },
  {
    n: "02",
    claim: "问卷把家族史压成「有 / 无」",
    lost: "谁、几岁发病、几个亲属 —— 三件最关键的事全部丢掉",
  },
  {
    n: "03",
    claim: "建议从不说能拿回什么",
    lost: "只说要运动，不复算；也不告诉你哪部分本就能拿回来",
  },
];

/** 问题：三行并置，每行的「丢掉的细节」在讲到时被划掉。 */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("problem");

  return (
    <Stage eyebrow="问题" eyebrowColor={HUES.background} bg="#fbf7f1">
      <Tag text="01 项目背景" color={HUES.background} opacity={0.9} />
      <H>
        家族史是<span style={{ color: C.danger }}>免费的风险信号</span>，却几乎没人记录
      </H>
      <Sub style={{ marginTop: 18 }}>三处都丢在同一个地方：没有结构化的家系</Sub>

      <div style={{ marginTop: 64 }}>
        {ROWS.map((r, i) => {
          const at = lineStart(b, Math.min(i, b.lines.length - 1)) + 6;
          const p = fadeIn(frame, at, 16);
          const strike = fadeIn(frame, at + 40, 26);
          return (
            <div key={r.n} style={{ ...rise(p, 20), display: "flex", gap: 34, alignItems: "flex-start", padding: "26px 0", borderTop: i === 0 ? "none" : "1px solid " + C.line }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: HUES.background, width: 78 }}>{r.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 46, fontWeight: 700 }}>{r.claim}</div>
                <div style={{ fontSize: 30, color: C.muted, marginTop: 10, position: "relative", display: "inline-block" }}>
                  {r.lost}
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "52%",
                      height: 3,
                      width: strike * 100 + "%",
                      background: C.danger,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};
