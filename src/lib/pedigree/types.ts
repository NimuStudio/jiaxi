/**
 * 家系数据模型
 *
 * 设计原则（见 proposals/pedigree-design.md）：
 *  - 家系图不是族谱，是一张「带权重的因果图」。
 *  - 数据结构是「节点 + 属性 + 置信度」，不是「人名列表」。
 *  - 家族史的价值由三个量决定：谁（亲缘等级）、几岁发病、几个亲属。
 *    缺任何一个，结论都可能反过来。因此每个属性都要能表达「不确定」。
 */

export type Sex = "male" | "female" | "unknown";

/**
 * 与先证者（用户本人）的血缘关系。
 * spouse 是结构需要（影响家庭单位），但不是血缘。
 */
export type RelationType =
  | "self"
  | "father"
  | "mother"
  | "son"
  | "daughter"
  | "brother"
  | "sister"
  | "paternal-grandfather"
  | "paternal-grandmother"
  | "maternal-grandfather"
  | "maternal-grandmother"
  | "paternal-uncle"
  | "paternal-aunt"
  | "maternal-uncle"
  | "maternal-aunt"
  | "spouse"
  | "unknown";

/** 亲缘等级：0 = 本人，1 = 一级，2 = 二级，3 = 更远/未知 */
export type Degree = 0 | 1 | 2 | 3;

export interface Age {
  value: number;
  certainty: "exact" | "approx";
}

export interface Condition {
  /** 规范化疾病编码（如 "type2-diabetes"、"colorectal-cancer"） */
  code: string;
  /** 用户原始口语描述 */
  rawText: string;
  /** 发病年龄（可为约数） */
  onsetAge?: Age;
  /** 证据：来自哪一轮对话的原文 */
  source: string;
  /** 抽取置信度 0–1 */
  confidence: number;
}

export interface Person {
  id: string;
  sex: Sex;
  deceased: boolean | "unknown";
  relation: RelationType;
  conditions: Condition[];
  /** 当前年龄（可缺省） */
  currentAge?: number;
}

export interface FamilyTree {
  probandId: string;
  persons: Record<string, Person>;
}
