import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, rise, fadeIn, typed, Mono } from "../ui";
import { blockById, lineStart } from "../schedule";

const NODES = [
  { id: "g1", x: 120, y: 40, label: "爷爷 · 糖尿病", male: true, hit: true },
  { id: "g2", x: 320, y: 40, label: "奶奶", male: false, hit: false },
  { id: "f", x: 220, y: 190, label: "父亲 · 心梗 52 岁", male: true, hit: true },
  { id: "m", x: 520, y: 190, label: "母亲", male: false, hit: false },
  { id: "u", x: 640, y: 190, label: "舅舅 · 糖尿病 45", male: true, hit: true },
  { id: "me", x: 372, y: 340, label: "本人", male: true, hit: false, self: true },
];

const SENTENCE = "我爸 52 岁放了支架，爷爷糖尿病，外公是脑溢血走的。";

/** 产品：一句口述 → 家系图长出来 → 每条病能回查原文 → 三个数字落下。 */
export const Product: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("product");
  const t0 = 4;
  const treeAt = lineStart(b, 1);
  const tagAt = lineStart(b, 2);
  const numAt = lineStart(b, 3);

  return (
    <Stage eyebrow="产品" eyebrowColor={HUES.product} bg={C.bg}>
      <Tag text="02 方案与产品" color={HUES.product} opacity={0.9} />
      <H size={72}>说一句话，<span style={{ color: HUES.product }}>一张家系图</span>就长出来</H>

      {/* 输入行 */}
      <div style={{ marginTop: 30, background: "#fff", border: "1px solid " + C.lineStrong, borderRadius: 16, padding: "22px 26px", display: "flex", gap: 18, alignItems: "center" }}>
        <div style={{ width: 12, height: 46, background: HUES.product, borderRadius: 3 }} />
        <div style={{ fontSize: 34, color: C.text, fontFamily: "inherit" }}>{typed(SENTENCE, frame, t0, 18)}</div>
        <span style={{ width: 3, height: 38, background: C.text, opacity: frame % 20 < 10 ? 1 : 0 }} />
      </div>

      {/* 家系图 */}
      <div style={{ position: "relative", height: 470, marginTop: 26 }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {[
            [155, 100, 220, 190],
            [355, 100, 220, 190],
            [220, 250, 372, 340],
            [520, 250, 372, 340],
          ].map(([x1, y1, x2, y2], i) => {
            const p = fadeIn(frame, treeAt + 16 + i * 6, 12);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.lineStrong} strokeWidth={3} strokeDasharray={1000} strokeDashoffset={(1 - p) * 1000} />;
          })}
        </svg>
        {NODES.map((n, i) => {
          const p = fadeIn(frame, treeAt + i * 9, 16);
          return (
            <div key={n.id} style={{ position: "absolute", left: n.x, top: n.y, ...rise(p, 14), opacity: p }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: n.male ? 10 : "50%",
                  border: "3px solid " + (n.self ? C.danger : C.primary),
                  background: n.hit ? C.primary : "#fff",
                  borderStyle: n.self ? "dashed" : "solid",
                }}
              />
              <div style={{ fontSize: 22, color: C.muted, marginTop: 8, whiteSpace: "nowrap" }}>{n.label}</div>
              {n.hit ? (
                <div style={{ fontSize: 18, color: HUES.product, marginTop: 2, opacity: fadeIn(frame, tagAt + i * 4, 12) }}>回查原文 ↗</div>
              ) : null}
            </div>
          );
        })}

        {/* 依据面板：第 2 句就开始占住右半边，不让右半屏空着 */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: 430,
            opacity: fadeIn(frame, lineStart(b, 1) - 12, 16),
          }}
        >
          <div style={{ fontSize: 21, color: C.muted, letterSpacing: 1 }}>每一条病都能回到原话</div>
          {[
            ["爷爷 · 糖尿病", "「爷爷糖尿病」"],
            ["父亲 · 心梗 52 岁", "「我爸 52 岁放了支架」"],
            ["外公 · 脑溢血", "「外公是脑溢血走的」"],
          ].map(([k, v], i) => (
            <div
              key={k}
              style={{
                marginTop: 12,
                background: "#fff",
                border: "1px solid " + C.line,
                borderRadius: 12,
                padding: "12px 16px",
                opacity: fadeIn(frame, lineStart(b, 1) + i * 8, 14),
              }}
            >
              <div style={{ fontSize: 23, fontWeight: 700, color: C.text }}>{k}</div>
              <div style={{ fontSize: 21, color: HUES.product, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Agent 追问气泡 */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 392,
            width: 430,
            background: "#fff",
            border: "1px solid " + C.lineStrong,
            borderRadius: 16,
            padding: "20px 22px",
            opacity: fadeIn(frame, tagAt + 6, 16),
          }}
        >
          <div style={{ fontSize: 22, color: HUES.product, fontWeight: 700 }}>Agent 追问</div>
          <div style={{ fontSize: 26, color: C.text, marginTop: 8, lineHeight: 1.45 }}>
            母系亲属是否患病？
          </div>
        </div>
      </div>

      {/* 三个数字 */}
      <div style={{ display: "flex", gap: 26, marginTop: 8 }}>
        {[
          ["33%", "现在的风险"],
          ["7 分", "可回收"],
          ["4%", "全部达标后"],
        ].map(([big, label], i) => {
          const p = fadeIn(frame, numAt + i * 10, 16);
          return (
            <div key={big} style={{ ...rise(p, 18), opacity: p, width: 300, background: "#fff", border: "1px solid " + C.line, borderRadius: 16, padding: "20px 24px" }}>
              <div style={{ fontSize: 58, fontWeight: 800, color: i === 2 ? HUES.product : C.text }}>{big}</div>
              <div style={{ fontSize: 24, color: C.muted, marginTop: 4 }}>{label}</div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};
