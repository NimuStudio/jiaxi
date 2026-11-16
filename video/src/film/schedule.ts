import timing from "../timing.json";

export type Line = { text: string; file: string; sec: number; frames: number };
export type Block = {
  id: string;
  title: string;
  lines: Line[];
  sec: number;
  frames: number;
  start: number;      // 绝对起始帧
};

/**
 * 时间轴由真实配音时长算出（scripts/tts.py → src/timing.json）。
 * 这里不写任何秒数常量：改一句文案，重跑 tts.py，整条时间轴自动变。
 */
const withStart = (): Block[] => {
  let cursor = 0;
  return (timing.blocks as Omit<Block, "start">[]).map((b) => {
    const block: Block = { ...b, start: cursor };
    cursor += b.frames;
    return block;
  });
};

export const BLOCKS = withStart();
export const TOTAL_FRAMES = BLOCKS.reduce((n, b) => n + b.frames, 0);
export const blockById = (id: string) => BLOCKS.find((b) => b.id === id)!;

/** 块内第 i 句的起始帧（相对块起点）。 */
export const lineStart = (b: Block, i: number) =>
  b.lines.slice(0, i).reduce((n, l) => n + l.frames, 0);

/** 0→1 的进度，带缓动；写动画时最常用。 */
export const easeOut = (p: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, p)), 3);
export const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
