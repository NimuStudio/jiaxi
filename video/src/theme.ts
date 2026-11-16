/**
 * 视频视觉常量。
 *
 * 取自产品 app/globals.css 的设计令牌——观众在动画里看到的蓝色，
 * 打开网站必须是同一个蓝色。六个栏目色与答辩稿 SECTION_HUES 一致。
 */
export const C = {
  bg: "#f2f7fc",
  surface: "#ffffff",
  text: "#0f2a44",
  muted: "#4a6b8a",
  faint: "#8aa3bb",
  line: "#dbe7f3",
  lineStrong: "#c2d6e9",
  primary: "#1a6fb5",
  primarySoft: "#eaf3fb",
  reclaim: "#0f7c8c",
  reclaimSoft: "#e6f4f6",
  reclaimLine: "#8fc4cb",
  danger: "#c0392b",
  dangerSoft: "#fbeee7",
  white: "#ffffff",
  ink: "#0b1a2b",
} as const;

/** 六个栏目的识别色，顺序与答辩稿一致。 */
export const HUES = {
  background: "#b06a08",
  product: "#0d7c8a",
  tech: "#1a6fb5",
  accuracy: "#684eba",
  value: "#b7445e",
  team: "#3a7c65",
} as const;

export const FONT =
  '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif';

export const MONO = '"Cascadia Mono", Consolas, "Courier New", monospace';

/** 视频统一 1920×1080 / 30fps。 */
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** 秒 -> 帧，写分镜时比数帧直观。 */
export const sec = (s: number) => Math.round(s * FPS);
