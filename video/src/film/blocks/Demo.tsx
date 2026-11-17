import React from "react";
import { OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, fadeIn } from "../ui";
import { blockById, lineStart } from "../schedule";

type Win = [number, number];
type Focus = [number, number, number];
// 浮层标注：相对画面左上角的百分比位置
type Note = { x: number; y: number; w?: number; text: string };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * 真实录屏段（参照用户给的参考片）：录屏铺满整屏，不套浏览器窗口框。
 *
 * 参考片的主体就是真实界面本身，包装只做两件事：
 *   1. 每条要点做成浮在画面上的玻璃标注框（不是右侧列表）；
 *   2. 关键时刻盖一个印章贴纸。
 * 之前录屏只占 60% 宽、还套了窗口 chrome，观感更像「PPT 里放了一张截图」。
 */
const Demo: React.FC<{
  block: string;
  steps: Win[];
  focuses: Focus[];
  notes: Note[];
  accent?: string;
  stamp?: { text: string; at: number; x: number; y: number };
}> = ({ block, steps, focuses, notes, accent = HUES.product, stamp }) => {
  const frame = useCurrentFrame();
  const b = blockById(block);

  let now = 0;
  b.lines.forEach((_, i) => {
    if (frame >= lineStart(b, i)) now = i;
  });
  const startNow = lineStart(b, now);
  const from = focuses[Math.max(0, now - 1)] ?? focuses[0];
  const to = focuses[now] ?? focuses[0];
  const k = interpolate(frame, [startNow, startNow + 18], [0, 1], clamp);
  const fs = from[2] + (to[2] - from[2]) * k;
  const fx = from[0] + (to[0] - from[0]) * k;
  const fy = from[1] + (to[1] - from[1]) * k;

  return (
    <Stage eyebrow="真实操作" eyebrowColor={accent} bg={C.bg} padTop={0} variant="light">
      {/* 录屏铺满整屏，按机位推拉 */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#0b1a2a" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: "translate(" + fx * 0.5 + "px," + fy * 0.5 + "px) scale(" + (1 + (fs - 1) * 0.55) + ")",
            transformOrigin: "50% 50%",
          }}
        >
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
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  muted
                />
              </Sequence>
            );
          })}
        </div>
        {/* 顶部与底部的极浅渐隐，保证文字压得住 */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,18,30,.55) 0%, rgba(6,18,30,0) 26%, rgba(6,18,30,0) 62%, rgba(6,18,30,.62) 100%)" }} />
      </div>

      {/* 左上角小标签 */}
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 30,
          padding: "10px 22px",
          borderRadius: 999,
          background: accent,
          color: "#fff",
          fontSize: 24,
          fontWeight: 800,
          opacity: fadeIn(frame, 0, 12),
        }}
      >
        录屏 · 未剪辑
      </div>

      {/* 浮层标注：随对应那句话出现，玻璃质感 */}
      {notes.map((n, i) => {
        // 一次只出一个标注：讲下一句时上一句淡出，画面才不堆
        const start = lineStart(b, i);
        const end = i + 1 < b.lines.length ? lineStart(b, i + 1) : b.frames;
        const p = Math.min(fadeIn(frame, start, 10), frame > end ? 0 : 1);
        if (p <= 0) {
          return null;
        }
        const lift = (1 - p) * 14;
        return (
          <div
            key={n.text}
            style={{
              position: "absolute",
              left: n.x * 19.2 + "px",
              top: n.y * 10.8 + "px",
              width: (n.w ?? 300) + "px",
              padding: "16px 22px",
              borderRadius: 14,
              background: "rgba(9,26,44,.72)",
              border: "1.5px solid " + accent + "aa",
              boxShadow: "0 12px 40px rgba(0,0,0,.45)",
              color: "#fff",
              fontSize: 27,
              fontWeight: 700,
              lineHeight: 1.45,
              opacity: p,
              transform: "translateY(" + lift + "px)",
            }}
          >
            <span style={{ color: accent, marginRight: 10 }}>0{i + 1}</span>
            {n.text}
          </div>
        );
      })}

      {/* 印章贴纸 */}
      {stamp && frame >= stamp.at && frame < stamp.at + 90 ? (
        <div
          style={{
            position: "absolute",
            left: stamp.x * 19.2 + "px",
            top: stamp.y * 10.8 + "px",
            padding: "14px 28px",
            border: "5px solid " + C.danger,
            color: C.danger,
            fontSize: 46,
            fontWeight: 900,
            letterSpacing: 4,
            borderRadius: 10,
            transform: "rotate(-9deg) scale(" + interpolate(frame, [stamp.at, stamp.at + 8], [1.5, 1], clamp) + ")",
            opacity: interpolate(frame, [stamp.at, stamp.at + 6], [0, 1], clamp),
            background: "rgba(255,255,255,.86)",
          }}
        >
          {stamp.text}
        </div>
      ) : null}
    </Stage>
  );
};

export const Demo1: React.FC = () => (
  <Demo
    block="demo1"
    steps={[[6, 9], [9, 10.5], [10.5, 19.5], [19.5, 21.5]]}
    focuses={[[60, -20, 1.06], [90, -30, 1.08], [-70, -10, 1.10], [-40, 30, 1.07]]}
    notes={[
      { x: 3, y: 66, text: "口述，不填表：想到谁说谁", w: 380 },
      { x: 3, y: 66, text: "不用按格式，顺序无所谓", w: 380 },
      { x: 62, y: 12, text: "按回车 → 本地抽取，图同步长出", w: 420 },
      { x: 62, y: 66, text: "每条病都能回查原话", w: 380 },
    ]}
    stamp={{ text: "本地推理", at: 150, x: 52, y: 46 }}
  />
);

export const Demo2: React.FC = () => (
  <Demo
    block="demo2"
    steps={[[21.5, 24.5], [24.5, 27], [27, 29.5], [29.5, 31.5]]}
    focuses={[[0, -50, 1.06], [-60, 40, 1.10], [50, -20, 1.08], [0, 50, 1.06]]}
    accent={HUES.value}
    notes={[
      { x: 3, y: 16, text: "切到心血管风险", w: 300 },
      { x: 62, y: 16, text: "China-PAR：未来 10 年 ASCVD", w: 420 },
      { x: 62, y: 66, text: "家族史已自动勾选", w: 360 },
      { x: 3, y: 66, text: "改任一项，实时重算", w: 340 },
    ]}
  />
);

export const Demo3: React.FC = () => (
  <Demo
    block="demo3"
    steps={[[32, 35.5], [35.5, 39], [39, 42.5], [42.5, 46]]}
    focuses={[[0, -70, 1.06], [-70, 20, 1.10], [80, 40, 1.11], [0, 70, 1.08]]}
    accent={HUES.value}
    notes={[
      { x: 3, y: 16, text: "糖尿病风险这一页", w: 320 },
      { x: 62, y: 16, text: "不给你笼统的「高风险」", w: 380 },
      { x: 62, y: 66, text: "四项全达标 → 4%", w: 320 },
      { x: 3, y: 66, text: "改不了的部分不该自责", w: 380 },
    ]}
    stamp={{ text: "33% → 4%", at: 330, x: 46, y: 40 }}
  />
);
