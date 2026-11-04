/**
 * 视频视觉常量。
 *
 * 全部取自产品 app/globals.css 的设计变量，保证视频与真实界面是同一套视觉语言——
 * 观众在动画里看到的颜色，打开网站必须是同一个颜色。
 */
export const C = {
  bg: "#f5f7f5",
  surface: "#ffffff",
  text: "#14181a",
  muted: "#66706e",
  faint: "#98a09d",
  line: "#e2e6e2",
  lineStrong: "#cfd5d0",
  primary: "#0f5f4c",
  primarySoft: "#e9f2ee",
  reclaim: "#c2610f",
  reclaimSoft: "#fbeedf",
  reclaimLine: "#e9a765",
  danger: "#a3271f",
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
