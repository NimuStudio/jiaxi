import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { BLOCKS, lineStart, TOTAL_FRAMES } from "./schedule";
import { C } from "../theme";
import { Hook } from "./blocks/Hook";
import { Problem } from "./blocks/Problem";
import { Product } from "./blocks/Product";
import { Risk } from "./blocks/Risk";
import { AI1, AI2, AI3 } from "./blocks/AIBlocks";
import { Value } from "./blocks/Value";
import { Evidence } from "./blocks/Evidence";
import { Close } from "./blocks/Close";
import { Demo1, Demo2, Demo3 } from "./blocks/Demo";
import { WhatWeDo, Arch, Deploy, Team } from "./blocks/Extras";
import { Subtitles } from "./Subtitles";
import { BlockTransition, Grain } from "./motion";
import { Ambient } from "./Ambient";
import { Hud } from "./Hud";
import { INTRO_ACCENT } from "./BlockIntro";
import { LineBeat } from "./LineBeats";

const BLOCK_COMPONENTS: Record<string, React.FC> = {
  hook: Hook,
  problem: Problem,
  whatwedo: WhatWeDo,
  demo1: Demo1,
  demo2: Demo2,
  demo3: Demo3,
  ai1: AI1,
  ai2: AI2,
  ai3: AI3,
  value: Value,
  arch: Arch,
  deploy: Deploy,
  evidence: Evidence,
  close: Close,
  team: Team,
};

// 每块的运镜方向：交替推近/平移，避免每段都是一样的运动
const CAMERA: Record<string, { push: number; pan: number; zoomFrom: number }> = {
  hook: { push: 0.06, pan: 0, zoomFrom: 1.02 },
  problem: { push: 0.04, pan: 0.5, zoomFrom: 1 },
  whatwedo: { push: 0.05, pan: -0.6, zoomFrom: 1 },
  demo1: { push: 0.018, pan: 0, zoomFrom: 1 },
  demo2: { push: 0.02, pan: 0.3, zoomFrom: 1 },
  demo3: { push: 0.02, pan: -0.3, zoomFrom: 1 },
  ai1: { push: 0.05, pan: 0.4, zoomFrom: 1 },
  ai2: { push: 0.05, pan: -0.4, zoomFrom: 1 },
  ai3: { push: 0.06, pan: 0, zoomFrom: 1 },
  arch: { push: 0.045, pan: 0, zoomFrom: 1 },
  deploy: { push: 0.045, pan: -0.5, zoomFrom: 1 },
  evidence: { push: 0.05, pan: 0, zoomFrom: 1.02 },
  value: { push: 0.045, pan: 0.5, zoomFrom: 1 },
  team: { push: 0.05, pan: 0, zoomFrom: 1 },
  close: { push: 0.07, pan: 0, zoomFrom: 1.03 },
};

/**
 * 成片：块按配音时长首尾相接；每块套一层「运镜 + 转场」，结尾统一压质感层。
 * 时长全部来自 timing.json——改一句文案重跑 tts.py，这里不用动。
 */
export const Film: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("audio/bgm.mp3")} volume={0.18} />
    {BLOCKS.map((b) => {
      const Comp = BLOCK_COMPONENTS[b.id];
      if (!Comp) {
        return null;
      }
      const cam = CAMERA[b.id] ?? { push: 0.045, pan: 0, zoomFrom: 1 };
      return (
        <Sequence key={b.id} from={b.start} durationInFrames={b.frames} name={b.title}>
          {/* 块级缩放已取消：文字被逐帧缩放会抖。视差交给 Backdrop 的漂移 */}
          <BlockTransition>
            <Comp />
          </BlockTransition>
          {/* 每句解说一个画面动作：圆环脉冲 + 编号牌（不用光带横穿画面） */}
          {b.lines.map((l, i) => (
            <Sequence key={"beat-" + l.file} from={lineStart(b, i)} durationInFrames={22} name={"beat-" + i}>
              <LineBeat accent={INTRO_ACCENT[b.id] ?? C.primary} index={i} />
            </Sequence>
          ))}
          {b.lines.map((l, i) => (
            <Sequence key={l.file} from={lineStart(b, i)} durationInFrames={l.frames} name={l.file}>
              <Audio src={staticFile("audio/" + l.file)} />
            </Sequence>
          ))}
        </Sequence>
      );
    })}
    {/* 常驻环境层：全片每一帧都有位移，兜住「画面不动」的观感 */}
    <Ambient accent="#2f7fb8" />
    {/* 字幕压在最上层：块之间切换时也不会被背景图盖住 */}
    <Subtitles />
    {/* HUD：章节号、时间码、句点、分段进度条（每秒都在走） */}
    <Hud accent="#1a6fb5" />
    <Grain strength={0.05} />
  </AbsoluteFill>
);

export const FILM_FRAMES = TOTAL_FRAMES;
