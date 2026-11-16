import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, HUES, MONO } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn } from "../ui";
import { blockById, lineStart } from "../schedule";

export const AI2: React.FC = () => <AI blockId="ai2" />;
export const AI3: React.FC = () => <AI blockId="ai3" />;

const ENUM = ["autosomal-dominant", "autosomal-recessive", "x-linked", "mitochondrial", "insufficient"];
const PROBS = [0.9005, 0.022, 0.0164, 0.0055, 0.0555];

/** AI 边界：上半约束解码，下半结构判定 + 40% vs 96% 对照。 */
export const AI: React.FC<{ blockId?: string }> = ({ blockId = "ai1" }) => {
  const frame = useCurrentFrame();
  const b = blockById(blockId);
  const a1 = lineStart(b, 0);
  const a2 = lineStart(b, 1);
  const a3 = lineStart(b, 2);

  const slot = Math.min(ENUM.length - 1, Math.floor(fadeIn(frame, a1 + 40, 40) * ENUM.length));
  const barP = (i: number) => interpolate(frame, [a2 + 10 + i * 8, a2 + 40 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <Stage eyebrow="AI 边界" eyebrowColor={HUES.accuracy} bg={C.bg}>
      <Tag text="04 准确性" color={HUES.accuracy} opacity={0.9} />
      <H size={76}>
        抽取交给模型，<span style={{ color: HUES.accuracy }}>判定不交给模型</span>
      </H>

      {/* 上半：约束解码 */}
      <div style={{ marginTop: 34, display: "flex", gap: 30, alignItems: "stretch" }}>
        <div style={{ flex: 1, background: "#fff", border: "1px solid " + C.line, borderRadius: 16, padding: "22px 26px" }}>
          <div style={{ fontSize: 24, color: C.muted, letterSpacing: 1 }}>抽取 · Qwen3-1.7B + GBNF</div>
          <div style={{ fontFamily: MONO, fontSize: 30, marginTop: 14, color: C.text }}>
            {"{\"mode\": \""}
            <span style={{ background: HUES.accuracy + "22", color: HUES.accuracy, padding: "0 6px", borderRadius: 6 }}>
              {ENUM[Math.min(slot, 4)]}
            </span>
            {"\"}"}
          </div>
          <div style={{ fontSize: 25, color: C.muted, marginTop: 12 }}>
            非法值在解码阶段就被挡回，模型「生成不出来」错词
          </div>
        </div>
        <div style={{ width: 420, background: "#fff", border: "1px solid " + C.line, borderRadius: 16, padding: "22px 26px" }}>
          <div style={{ fontSize: 24, color: C.muted }}>判定 · 12 维结构信号</div>
          <div style={{ marginTop: 16 }}>
            {ENUM.map((e, i) => (
              <div key={e} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
                <div style={{ width: 150, fontSize: 18, color: C.muted, fontFamily: MONO }}>{e.slice(0, 12)}</div>
                <div style={{ flex: 1, height: 16, background: "#eef3f8", borderRadius: 999 }}>
                  <div
                    style={{
                      height: 16,
                      width: barP(i) * PROBS[i] * 100 + "%",
                      background: i === 0 ? HUES.accuracy : C.lineStrong,
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ width: 74, fontSize: 18, color: C.muted, fontFamily: MONO }}>{PROBS[i].toFixed(3)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 下半：对照 */}
      <div style={{ marginTop: 40, opacity: fadeIn(frame, a3 + 30, 18) }}>
        <div style={{ fontSize: 30, color: C.muted, marginBottom: 16 }}>同一个任务，两种做法（各 30 条均衡样本）</div>
        {[
          { label: "通用决策模型 OpenJev-Q4 · 18.5 GB", v: 40, color: C.lineStrong, text: "#4a6b8a" },
          { label: "12 维结构逻辑回归 · 2.3 KB", v: 96, color: HUES.accuracy, text: HUES.accuracy },
        ].map((row, i) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 14 }}>
            <div style={{ width: 470, fontSize: 24, color: C.muted }}>{row.label}</div>
            <div style={{ flex: 1, height: 30, background: "#eef3f8", borderRadius: 6, position: "relative" }}>
              <div style={{ height: 30, width: (row.v * barP(i + 3)) / 1.05 + "%", background: row.color, borderRadius: 6 }} />
            </div>
            <div style={{ width: 110, fontSize: 32, fontWeight: 800, color: row.text }}>{row.v}%</div>
          </div>
        ))}
      </div>
    </Stage>
  );
};
