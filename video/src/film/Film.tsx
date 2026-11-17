import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { BLOCKS, lineStart, TOTAL_FRAMES } from "./schedule";
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
import { BlockTransition, Camera, Grain, Sweep } from "./motion";

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
  demo1: { push: 0.03, pan: 0, zoomFrom: 1 },
  demo2: { push: 0.04, pan: 0.4, zoomFrom: 1 },
  demo3: { push: 0.04, pan: -0.4, zoomFrom: 1 },
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
          <Camera push={cam.push} pan={cam.pan} zoomFrom={cam.zoomFrom}>
            <BlockTransition>
              <Comp />
            </BlockTransition>
          </Camera>
          <Sweep at={2} dur={24} color={b.id === "hook" || b.id === "close" || b.id === "evidence" ? "#7fc3cb" : "#9fd8ff"} />
          {b.lines.map((l, i) => (
            <Sequence key={l.file} from={lineStart(b, i)} durationInFrames={l.frames} name={l.file}>
              <Audio src={staticFile("audio/" + l.file)} />
            </Sequence>
          ))}
        </Sequence>
      );
    })}
    {/* 字幕压在最上层：块之间切换时也不会被背景图盖住 */}
    <Subtitles />
    <Grain strength={0.05} />
  </AbsoluteFill>
);

export const FILM_FRAMES = TOTAL_FRAMES;
