/**
 * 家系图的可视化配置：槽位坐标、连线、中文标签
 *
 * 布局采用「固定槽位」而不是力导向：
 *  - 家系图的结构是确定的（父系在左、母系在右、辈分从上到下），
 *    力导向反而会让每次渲染的位置都不一样，用户会觉得图在乱跳；
 *  - 固定槽位还有一个好处：新节点出现时，老节点不会移动，
 *    视觉上就是「图上长出一个新的」，而不是「整张图重新排一次」。
 */

import type { RelationType } from "./types";

export interface Slot {
  x: number;
  y: number;
}

/** 画布尺寸（viewBox），所有坐标基于此。 */
export const CANVAS = { width: 640, height: 470 };

/**
 * 每个亲属关系的固定位置。
 * 横向：父系（左）→ 本人（中）→ 母系（右）
 * 纵向：祖辈(70) → 父辈(195) → 本人辈(315) → 子女辈(425)
 */
export const SLOTS: Partial<Record<RelationType, Slot>> = {
  // 祖辈
  "paternal-grandfather": { x: 95, y: 70 },
  "paternal-grandmother": { x: 200, y: 70 },
  "maternal-grandfather": { x: 440, y: 70 },
  "maternal-grandmother": { x: 545, y: 70 },

  // 父辈
  "paternal-uncle": { x: 72, y: 195 },
  "paternal-aunt": { x: 168, y: 195 },
  father: { x: 265, y: 195 },
  mother: { x: 365, y: 195 },
  "maternal-uncle": { x: 462, y: 195 },
  "maternal-aunt": { x: 558, y: 195 },

  // 本人辈
  brother: { x: 248, y: 315 },
  self: { x: 315, y: 315 },
  sister: { x: 382, y: 315 },

  // 子女辈
  son: { x: 272, y: 425 },
  daughter: { x: 358, y: 425 },
};

/**
 * 血缘连线（两端节点都存在时才绘制）。婚配线单独处理。
 *
 * 注意：祖辈到旁系（伯叔姑舅姨）刻意列成「任一同系祖辈 → 该旁系」，
 * 因为用户常常只提到祖辈中的一位。如果只写爷爷→伯叔、奶奶→姑姑，
 * 那么「只说了外婆和舅舅」的情况下，舅舅就成了悬空的孤点。
 * 渲染时会跳过端点缺失的边，多余的边不会画出来。
 */
export const EDGES: ReadonlyArray<readonly [RelationType, RelationType]> = [
  ["paternal-grandfather", "father"],
  ["paternal-grandmother", "father"],
  ["maternal-grandfather", "mother"],
  ["maternal-grandmother", "mother"],

  ["paternal-grandfather", "paternal-uncle"],
  ["paternal-grandmother", "paternal-uncle"],
  ["paternal-grandfather", "paternal-aunt"],
  ["paternal-grandmother", "paternal-aunt"],

  ["maternal-grandfather", "maternal-uncle"],
  ["maternal-grandmother", "maternal-uncle"],
  ["maternal-grandfather", "maternal-aunt"],
  ["maternal-grandmother", "maternal-aunt"],

  ["father", "self"],
  ["mother", "self"],
  ["father", "brother"],
  ["mother", "sister"],
  ["self", "son"],
  ["self", "daughter"],
];

/** 关系的中文说法（画在节点下方）。 */
export const RELATION_LABEL: Partial<Record<RelationType, string>> = {
  father: "父亲",
  mother: "母亲",
  brother: "兄弟",
  sister: "姐妹",
  son: "儿子",
  daughter: "女儿",
  "paternal-grandfather": "爷爷",
  "paternal-grandmother": "奶奶",
  "maternal-grandfather": "外公",
  "maternal-grandmother": "外婆",
  "paternal-uncle": "伯叔",
  "paternal-aunt": "姑姑",
  "maternal-uncle": "舅舅",
  "maternal-aunt": "姨妈",
  self: "本人",
};

/**
 * 疾病编码的中文标签。
 *
 * 注意：这些是**本项目内部的归一化名称**，用于界面展示，
 * 不对应 ICD-10 等标准编码体系（见 docs/references.md）。
 */
export const DISEASE_LABEL: Record<string, string> = {
  "myocardial-infarction": "心梗",
  "coronary-heart-disease": "冠心病",
  stroke: "脑卒中",
  hypertension: "高血压",
  "type2-diabetes": "糖尿病",
  "colorectal-cancer": "肠癌",
  "breast-cancer": "乳腺癌",
  "gastric-cancer": "胃癌",
  "lung-cancer": "肺癌",
  other: "其他",
};

/** 男性画方形、女性画圆形；未知按方形处理并标注。 */
export function isMale(sex: string): boolean {
  return sex !== "female";
}
