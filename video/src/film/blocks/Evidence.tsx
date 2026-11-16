import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, HUES, MONO } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn } from "../ui";
import { blockById, lineStart } from "../schedule";

const LINES = [
  "  $ pnpm vitest run --reporter=dot",
  "  Test Files  31 passed (31)",
  "       Tests  238 passed (238)",
  "    Duration  1.70s",
  "",
  "  $ node scripts/eval-extract.ts",
  "  holdout 6 x 30 = 180   F1 0.877 -> 1.000",
  "",
  "  $ curl -s -X POST /api/decision/hereditary",
  '  {"mode":"autosomal-dominant","confidence":0.9978,',
  '   "gaps":["母系亲属是否患病"]}',
];

/** 证据：终端原样输出滚入，右下角本机边界收紧。 */
export const Evidence: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("evidence");
  const a1 = lineStart(b, 0);
  const a2 = lineStart(b, 1);
  const a3 = lineStart(b, 2);

  // 三组对应解说三句：0-4 测试、5-6 留出集、7-10 接口；组内每 12 帧吐一行
  const GROUPS: [number, number, number][] = [
    [0, 5, a1],
    [5, 7, a2],
    [7, LINES.length, a3],
  ];
  const shown = Math.max(
    ...GROUPS.map(([start, end, at]) => {
      if (frame < at) {
        return start;           // 还没轮到这一组：保持上一组已吐出的行数
      }
      return Math.min(end, start + Math.floor((frame - at) / 12) + 1);
    }),
  );
  const scroll = interpolate(frame, [0, b.frames], [0, -26], {
    extrapolateRight: "clamp",
  });

  return (
    <Stage eyebrow="证据" eyebrowColor={HUES.value} bg={C.ink}>
      <Tag text="证据 · 可复现" color={HUES.value} opacity={0.92} />
      <div style={{ fontSize: 66, fontWeight: 800, color: "#fff", lineHeight: 1.24 }}>
        每一条结论，都能在演示机上<span style={{ color: "#7fc3cb" }}>跑给你看</span>
      </div>

      <div style={{ display: "flex", gap: 34, marginTop: 30 }}>
        <div
          style={{
            flex: 1,
            background: "#0f2236",
            border: "1px solid #1d3a55",
            borderRadius: 14,
            padding: "22px 26px",
            minHeight: 330,
            overflow: "hidden",
          }}
        >
          <div style={{ transform: "translateY(" + scroll + "px)" }}>
          {LINES.slice(0, Math.max(4, shown)).map((l, i) => (
            <div
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: 24,
                lineHeight: 1.62,
                color: l.includes("passed") || l.includes("F1") ? "#8fe3a0" : "#cfe0f0",
                opacity: i < shown ? 1 : 0,
              }}
            >
              {l || " "}
            </div>
          ))}
          </div>
        </div>

        <div style={{ width: 430 }}>
          {[
            { k: "31 个测试文件", v: "238 条用例 · 1.70s 全绿", at: a1 },
            { k: "留出集 F1", v: "0.877 → 1.000", at: a2 },
            { k: "真实接口返回", v: "99.8% · 含缺口追问", at: a3 },
          ].map((row) => {
            const p = fadeIn(frame, row.at + 20, 16);
            return (
              <div key={row.k} style={{ opacity: p, borderTop: "1px solid #1d3a55", padding: "18px 0" }}>
                <div style={{ fontSize: 22, color: "#7fa3c4" }}>{row.k}</div>
                <div style={{ fontSize: 30, color: "#fff", fontWeight: 700, marginTop: 6 }}>{row.v}</div>
              </div>
            );
          })}

          <div
            style={{
              marginTop: 26,
              border: "2px dashed #7fc3cb",
              borderRadius: 14,
              padding: "18px 20px",
              opacity: fadeIn(frame, a3 + 50, 18),
            }}
          >
            <div style={{ fontSize: 24, color: "#7fc3cb", fontWeight: 700 }}>本机边界</div>
            <Sub size={24} color="#cfe0f0" style={{ marginTop: 8 }}>
              100% 本机推理 · 代码里没有任何外部 API 调用 · 断网可演示
            </Sub>
          </div>
        </div>
      </div>
    </Stage>
  );
};
