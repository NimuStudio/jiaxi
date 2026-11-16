import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { BLOCKS, lineStart, TOTAL_FRAMES } from "./schedule";
import { Hook } from "./blocks/Hook";
import { Problem } from "./blocks/Problem";
import { Product } from "./blocks/Product";
import { Risk } from "./blocks/Risk";
import { AI } from "./blocks/AI";
import { Evidence } from "./blocks/Evidence";
import { Close } from "./blocks/Close";
import { Demo1, Demo2, Demo3 } from "./blocks/Demo";
import { WhatWeDo, Arch, Deploy, Team } from "./blocks/Extras";

const BLOCK_COMPONENTS: Record<string, React.FC> = {
  hook: Hook,
  problem: Problem,
  whatwedo: WhatWeDo,
  demo1: Demo1,
  demo2: Demo2,
  demo3: Demo3,
  ai1: AI,
  ai2: AI,
  ai3: AI,
  arch: Arch,
  deploy: Deploy,
  evidence: Evidence,
  value: Risk,
  close: Close,
  team: Team,
};

/**
 * 成片：块按配音时长首尾相接，每句一个 Audio，画面对齐块起点。
 * 时长全部来自 timing.json——改一句文案重跑 tts.py，这里不用动。
 */
export const Film: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("audio/bgm.mp3")} volume={0.11} />
    {BLOCKS.map((b) => {
      const Comp = BLOCK_COMPONENTS[b.id];
      if (!Comp) {
        return null;
      }
      return (
        <Sequence key={b.id} from={b.start} durationInFrames={b.frames} name={b.title}>
          <Comp />
          {b.lines.map((l, i) => (
            <Sequence key={l.file} from={lineStart(b, i)} durationInFrames={l.frames} name={l.file}>
              <Audio src={staticFile("audio/" + l.file)} />
            </Sequence>
          ))}
        </Sequence>
      );
    })}
  </AbsoluteFill>
);

export const FILM_FRAMES = TOTAL_FRAMES;
