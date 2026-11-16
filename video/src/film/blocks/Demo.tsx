import React from "react";
import { OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, fadeIn, rise } from "../ui";
import { blockById } from "../schedule";

type Callout = { at: number; text: string };

/**
 * 真实录屏段：左边设备框里放录屏（1600×910 按 1160×660 等比），右边竖排解说要点。
 * 要点放右侧而不是压在画面上——录屏本身就是证据，不能被挡。
 */
const Demo: React.FC<{
  block: string;
  fromSec: number;
  toSec: number;
  title: React.ReactNode;
  callouts: Callout[];
  accent?: string;
}> = ({ block, fromSec, toSec, title, callouts, accent = HUES.product }) => {
  const frame = useCurrentFrame();
  const b = blockById(block);
  const rate = ((toSec - fromSec) * 30) / Math.max(1, b.frames);
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
        {/* 设备框：1160 宽 → 内容高 660，刚好与 1600×910 等比 */}
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
          <div style={{ height: 660, overflow: "hidden" }}>
            <OffthreadVideo
              src={staticFile("rec/demo.mp4")}
              startFrom={Math.round(fromSec * 30)}
              playbackRate={rate}
              style={{ width: 1160, display: "block" }}
              muted
            />
          </div>
        </div>

        {/* 右侧要点 */}
        <div style={{ width: 520, paddingTop: 8 }}>
          {callouts.map((c, i) => {
            const q = fadeIn(frame, c.at, 14);
            return (
              <div
                key={c.text}
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
                <div style={{ fontSize: 25, color: C.text, marginTop: 4, lineHeight: 1.4 }}>{c.text}</div>
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
    fromSec={2}
    toSec={20}
    title={<>说一句话，<span style={{ color: HUES.product }}>家系图实时长出</span></>}
    callouts={[
      { at: 20, text: "口述，不填表：想到谁说谁，顺序无所谓" },
      { at: 150, text: "本地模型抽取，家系图同步长出节点" },
      { at: 330, text: "每条病都能回到原话核对，抽错可删" },
    ]}
  />
);

export const Demo2: React.FC = () => (
  <Demo
    block="demo2"
    fromSec={20}
    toSec={30}
    title={<>家族史<span style={{ color: HUES.value }}>直接进国家指南方程</span></>}
    accent={HUES.value}
    callouts={[
      { at: 20, text: "China-PAR：未来 10 年 ASCVD 风险" },
      { at: 150, text: "家系图里有一级亲属心梗，家族史自动勾选" },
      { at: 330, text: "改任一项，风险实时重算，纯本地" },
    ]}
  />
);

export const Demo3: React.FC = () => (
  <Demo
    block="demo3"
    fromSec={30}
    toSec={46}
    title={<>风险拆开算：<span style={{ color: HUES.value }}>7 分能改，9 分改不了</span></>}
    accent={HUES.value}
    callouts={[
      { at: 20, text: "33% 里，7 分来自 BMI、腰围、运动、蔬果" },
      { at: 190, text: "四项全达标 → 4%，可回收的部分被算出来" },
      { at: 360, text: "剩下 9 分来自年龄、家族史、用药，不该自责" },
    ]}
  />
);
