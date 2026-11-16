import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, HUES, MONO } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn, rise } from "../ui";
import { blockById, lineStart } from "../schedule";

const ENUM = ["autosomal-dominant", "autosomal-recessive", "x-linked", "mitochondrial", "insufficient"];
const PROBS = [0.9005, 0.022, 0.0164, 0.0055, 0.0555];

/** ai1：抽取怎么做准 —— 左：句子进槽位；右：三道保险竖排。 */
export const AI1: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("ai1");

  const guards = [
    ["语法约束", "非法 token 在解码阶段就被挡回"],
    ["规则兜底", "模型漏抽 → 原文里找最长命中"],
    ["原文回查", "查不到出处的病名，直接剔除"],
  ];

  return (
    <Stage eyebrow="AI 亮点 ①" eyebrowColor={HUES.accuracy} bg={C.bg} padTop={84}>
      <Tag text="04 准确性" color={HUES.accuracy} opacity={0.9} />
      <H size={66}>抽取交给模型，<span style={{ color: HUES.accuracy }}>但模型生成不出错词</span></H>

      <div style={{ display: "flex", gap: 44, marginTop: 40 }}>
        <div style={{ width: 900 }}>
          <Sub size={25}>模型 · Qwen3-1.7B + GBNF 约束解码</Sub>
          <div style={{ marginTop: 14, background: "#fff", border: "1px solid " + C.line, borderRadius: 14, padding: "22px 26px" }}>
            <Mono size={26} color={C.muted}>{"{\"mode\": \"…\"}"}</Mono>
            <div style={{ marginTop: 12 }}>
              {ENUM.map((e, i) => {
                const p = fadeIn(frame, 30 + i * 10, 12);
                const chosen = i === 0;
                return (
                  <div
                    key={e}
                    style={{
                      ...rise(p, 8),
                      opacity: p,
                      fontFamily: MONO,
                      fontSize: 24,
                      padding: "8px 14px",
                      marginBottom: 6,
                      borderRadius: 8,
                      background: chosen ? HUES.accuracy + "18" : "#f6f9fc",
                      color: chosen ? HUES.accuracy : C.faint,
                      border: chosen ? "1px solid " + HUES.accuracy : "1px solid transparent",
                    }}
                  >
                    {e}
                    {chosen ? <span style={{ marginLeft: 12, fontFamily: "inherit", fontSize: 20 }}>← 只能落在这五个值里</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, paddingTop: 30 }}>
          {guards.map(([t, d], i) => {
            const p = fadeIn(frame, lineStart(b, Math.min(i + 1, 3)), 14);
            return (
              <div key={t} style={{ ...rise(p, 10), opacity: p, borderLeft: "4px solid " + HUES.accuracy, paddingLeft: 16, marginBottom: 22 }}>
                <div style={{ fontSize: 30, fontWeight: 800 }}>{t}</div>
                <Sub size={24} style={{ marginTop: 6 }}>{d}</Sub>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

/** ai2：判定不交给模型 —— 12 维信号 → 概率 + 门槛 → 输出卡片。 */
export const AI2: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("ai2");
  const a1 = lineStart(b, 1);

  return (
    <Stage eyebrow="AI 亮点 ②" eyebrowColor={HUES.accuracy} bg={C.bg} padTop={84}>
      <Tag text="04 准确性" color={HUES.accuracy} opacity={0.9} />
      <H size={66}>判定这一步，<span style={{ color: HUES.accuracy }}>交给确定性计算</span></H>

      <div style={{ display: "flex", gap: 34, marginTop: 36, alignItems: "flex-start" }}>
        {/* 12 维信号网格 */}
        <div style={{ width: 460 }}>
          <Sub size={24}>家系结构信号 · 12 维</Sub>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
            {Array.from({ length: 12 }).map((_, i) => {
              const p = fadeIn(frame, 12 + i * 6, 10);
              return (
                <div
                  key={i}
                  style={{
                    opacity: p,
                    height: 54,
                    borderRadius: 8,
                    background: HUES.accuracy + (i % 3 === 0 ? "26" : "12"),
                    border: "1px solid " + HUES.accuracy + "40",
                    fontSize: 16,
                    color: C.muted,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  d{i + 1}
                </div>
              );
            })}
          </div>
        </div>

        {/* 概率 + 门槛 */}
        <div style={{ flex: 1 }}>
          <Sub size={24}>五种模式概率 · 门槛 0.55 / 0.70</Sub>
          <div style={{ marginTop: 16, position: "relative" }}>
            {ENUM.map((e, i) => {
              const p = interpolate(frame, [a1 + i * 8, a1 + 34 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div key={e} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <div style={{ width: 230, fontSize: 20, fontFamily: MONO, color: C.muted }}>{e}</div>
                  <div style={{ flex: 1, height: 26, background: "#eef3f8", borderRadius: 6 }}>
                    <div style={{ height: 26, width: PROBS[i] * 100 * p + "%", background: i === 0 ? HUES.accuracy : C.lineStrong, borderRadius: 6 }} />
                  </div>
                  <div style={{ width: 80, fontSize: 22, fontWeight: 800, color: i === 0 ? HUES.accuracy : C.muted }}>
                    {(PROBS[i] * p).toFixed(3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 输出卡 */}
        <div
          style={{
            width: 380,
            opacity: fadeIn(frame, lineStart(b, 2), 16),
            background: "#fff",
            border: "1px solid " + C.line,
            borderTop: "4px solid " + HUES.accuracy,
            borderRadius: 14,
            padding: "20px 22px",
          }}
        >
          <div style={{ fontSize: 22, color: C.muted }}>界面输出</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>提示 · 常染色体显性</div>
          <div style={{ fontSize: 24, color: HUES.accuracy, marginTop: 6 }}>置信度 87%</div>
          <Sub size={22} style={{ marginTop: 10 }}>不是诊断。置信度不足时退回「证据不足」并列出缺口。</Sub>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 150,
          display: "flex",
          gap: 40,
          opacity: fadeIn(frame, lineStart(b, 3), 16),
        }}
      >
        {[
          ["门槛", "决策 0.55 / 结构 0.70 / 打分 0.80，不达标就不下结论"],
          ["超时", "30 秒自动降级到规则判定，界面上标「证据不足」"],
          ["可切", "INHERITANCE_BACKEND=model 才走决策模型，默认走结构"],
        ].map(([k, v]) => (
          <div key={k} style={{ flex: 1, borderTop: "3px solid " + HUES.accuracy, paddingTop: 12 }}>
            <div style={{ fontSize: 22, color: HUES.accuracy, fontWeight: 800 }}>{k}</div>
            <Sub size={22} style={{ marginTop: 6 }}>{v}</Sub>
          </div>
        ))}
      </div>
    </Stage>
  );
};

/** ai3：对照实验 —— 两条大横条 + 结论。 */
export const AI3: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("ai3");
  const rows = [
    { name: "通用决策模型 OpenJev-Q4", size: "18.5 GB", v: 40, wrong: "隐性 / X 连锁 / 线粒体：三类全判错", color: C.lineStrong, ink: C.muted },
    { name: "12 维结构逻辑回归", size: "2.3 KB", v: 96, wrong: "同一批样本，三类全对", color: HUES.accuracy, ink: HUES.accuracy },
  ];
  return (
    <Stage eyebrow="AI 亮点 ③" eyebrowColor={HUES.accuracy} bg={C.bg} padTop={84}>
      <Tag text="证据 · 对照实验" color={HUES.accuracy} opacity={0.9} />
      <H size={66}>同一个任务，<span style={{ color: HUES.accuracy }}>两种做法差 56 个百分点</span></H>
      <Sub size={26} style={{ marginTop: 12 }}>均衡样本，每类 5 条，共 30 条；同一份输入，只换判定后端</Sub>

      <div style={{ marginTop: 52 }}>
        {rows.map((r, i) => {
          const p = fadeIn(frame, 16 + i * 14, 14);
          return (
            <div key={r.name} style={{ ...rise(p, 12), opacity: p, marginBottom: 34 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <div style={{ fontSize: 30, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 22, color: C.faint }}>{r.size}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 10 }}>
                <div style={{ flex: 1, height: 52, background: "#eef3f8", borderRadius: 8 }}>
                  <div style={{ height: 52, width: (r.v * p) / 1.02 + "%", background: r.color, borderRadius: 8 }} />
                </div>
                <div style={{ width: 150, fontSize: 52, fontWeight: 800, color: r.ink }}>{r.v}%</div>
              </div>
              <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>{r.wrong}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, opacity: fadeIn(frame, lineStart(b, 3), 16), background: HUES.accuracy + "12", borderLeft: "5px solid " + HUES.accuracy, borderRadius: 10, padding: "18px 22px" }}>
        <div style={{ fontSize: 30, fontWeight: 800 }}>不是模型不好，是这类问题不该由参数量决定</div>
        <Sub size={24} style={{ marginTop: 6 }}>40% 是通用决策模型的表现；我们把它完整接进来了，作为可切换的对照后端。</Sub>
      </div>
    </Stage>
  );
};
