import React from "react";
import { OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, fadeIn, rise } from "../ui";
import { blockById, lineStart } from "../schedule";

type Win = [number, number];

/**
 * 真实录屏段：**逐句对位**。
 *
 * 关键：每一句解说对应一段真实录屏窗口，片段与该句等长。
 * 第一版是「整段录屏按块时长等比拉慢」（demo1 rate=0.55），讲到「按回车之后」时
 * 画面还在打字——这就是画面与配音不符的原因。
 */
const Demo: React.FC<{
  block: string;
  steps: Win[];
  title: React.ReactNode;
  callouts: string[];
  accent?: string;
}> = ({ block, steps, title, callouts, accent = HUES.product }) => {
  const frame = useCurrentFrame();
  const b = blockById(block);
  const p = fadeIn(frame, 0, 12);

  return (
    <Stage eyebrow="真实操作" eyebrowColor={accent} bg={C.bg} padTop={84}>
      <div
        style={{
          position: "absolute",
          top: 54,
          right: 120,
          padding: "9px 20px",
          borderRadius: 999,
          background: accent,
          color: "#fff",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        录屏 · 未剪辑
      </div>

      <div style={{ ...rise(p, 12), opacity: p }}>
        <H size={54}>{title}</H>
      </div>

      <div style={{ display: "flex", gap: 40, marginTop: 20 }}>
        <div
          style={{
            width: 1160,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid " + C.lineStrong,
            boxShadow: "0 26px 60px rgba(15,42,68,.16)",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <div style={{ height: 30, background: "#eef3f9", display: "flex", alignItems: "center", gap: 7, padding: "0 12px" }}>
            {["#ff5f56", "#ffbd2e", "#27c93f"].map((c) => (
              <span key={c} style={{ width: 9, height: 9, borderRadius: 5, background: c }} />
            ))}
            <span style={{ marginLeft: 8, fontSize: 16, color: C.muted }}>127.0.0.1:5173</span>
          </div>
          <div style={{ height: 653, overflow: "hidden", position: "relative" }}>
            {b.lines.map((l, i) => {
              const win = steps[Math.min(i, steps.length - 1)];
              const sourceFrames = Math.round((win[1] - win[0]) * 30);
              const rate = sourceFrames / Math.max(1, l.frames);
              return (
                <Sequence key={l.file} from={lineStart(b, i)} durationInFrames={l.frames} name={"seg-" + i}>
                  <OffthreadVideo
                    src={staticFile("rec/demo.mp4")}
                    startFrom={Math.round(win[0] * 30)}
                    playbackRate={rate}
                    style={{ width: 1160, display: "block" }}
                    muted
                  />
                </Sequence>
              );
            })}
          </div>
        </div>

        <div style={{ width: 520, paddingTop: 8 }}>
          {callouts.map((text, i) => {
            const q = fadeIn(frame, lineStart(b, i), 12);
            return (
              <div
                key={text}
                style={{
                  ...rise(q, 12),
                  opacity: q,
                  background: "#fff",
                  border: "1px solid " + C.line,
                  borderLeft: "4px solid " + accent,
                  borderRadius: 10,
                  padding: "16px 18px",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 18, color: accent, fontWeight: 800 }}>0{i + 1}</div>
                <div style={{ fontSize: 25, color: C.text, marginTop: 4, lineHeight: 1.4 }}>{text}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

export const Demo1: React.FC = () => (
  <Demo
    block="demo1"
    steps={[[6, 9], [9, 10.5], [10.5, 19.5], [19.5, 21.5]]}
    title={<>说一句话，<span style={{ color: HUES.product }}>家系图实时长出</span></>}
    callouts={["口述，不填表：想到谁说谁", "不用按格式，顺序无所谓", "按回车 → 本地抽取，图同步长出", "每条病都能回查原话"]}
  />
);

export const Demo2: React.FC = () => (
  <Demo
    block="demo2"
    steps={[[21.5, 24.5], [24.5, 27], [27, 29.5], [29.5, 31.5]]}
    title={<>家族史<span style={{ color: HUES.value }}>直接进国家指南方程</span></>}
    accent={HUES.value}
    callouts={["切到心血管风险", "China-PAR：未来 10 年 ASCVD", "家族史已自动勾选", "改任一项，实时重算"]}
  />
);

export const Demo3: React.FC = () => (
  <Demo
    block="demo3"
    steps={[[32, 35.5], [35.5, 39], [39, 42.5], [42.5, 46]]}
    title={<>风险拆开算：<span style={{ color: HUES.value }}>7 分能改，9 分改不了</span></>}
    accent={HUES.value}
    callouts={["糖尿病风险这一页", "不给你笼统的「高风险」", "四项全达标 → 4%", "改不了的部分不该自责"]}
  />
);
