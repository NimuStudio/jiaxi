/**
 * FINDRISC — 芬兰糖尿病风险评分（Finnish Diabetes Risk Score）
 *
 * 出处：
 *  - Lindström J, Tuomilehto J. The Diabetes Risk Score: A practical tool to
 *    predict type 2 diabetes risk. Diabetes Care. 2003;26(3):725-731.
 *  - 10 年风险分层数值来源：Lindström 2010（IDF 在线工具同款）。
 *
 * 为什么用 FINDRISC 作为第一个落地模型：
 *  1. 系数完全公开、逐项确定，可做严格的回归测试（可复现性最高）。
 *  2. 条目天然分成「可改变 / 不可改变」两组，直接对应产品的「可回收风险」概念。
 *  3. 家族史条目（一级 5 分 / 二级 3 分）与家系图数据模型天然对齐。
 *
 * 重要：FINDRISC 输出的是「10 年发病风险」的官方口径，不是本产品自定义的
 * 「患病概率」。本模块只做评分与反事实对比，不产出任何绝对诊断结论。
 */

export type Sex = "male" | "female";
export type FamilyHistory = "none" | "second" | "first";
export type RiskBand = "very-low" | "low" | "moderate" | "high" | "very-high";

export interface FindriscInput {
  /** 年龄（岁） */
  age: number;
  /** 体质指数 BMI（kg/m²） */
  bmi: number;
  /** 腰围（cm，肚脐水平） */
  waistCm: number;
  sex: Sex;
  /** 是否每天 ≥30 分钟体力活动（工作或闲暇） */
  physicallyActive: boolean;
  /** 是否每天吃蔬菜、水果 */
  eatsVegetablesDaily: boolean;
  /** 是否曾规律服用降压药 */
  onAntihypertensive: boolean;
  /** 是否曾被发现高血糖（体检/患病/妊娠期间） */
  historyOfHighGlucose: boolean;
  /** 糖尿病家族史：无 / 二级亲属（祖父母、叔姑舅姨、表亲）/ 一级亲属（父母、兄弟姐妹、子女） */
  familyHistory: FamilyHistory;
}

export interface RiskBandInfo {
  band: RiskBand;
  tenYearRiskPercent: number;
}

export interface FindriscResult {
  /** 总分（0–26） */
  score: number;
  /** 每个条目的分值明细 */
  breakdown: Record<ScoreKey, number>;
  /** 当前 10 年风险分层与百分比 */
  current: RiskBandInfo;
  /** 可改变条目当前贡献的分数 */
  modifiableScore: number;
  /** 可改变条目全部达标后的总分 */
  bestAchievableScore: number;
  /** 达标后的分层与百分比 */
  best: RiskBandInfo;
  /** 可回收的分数 = modifiableScore */
  reclaimablePoints: number;
}

export type ScoreKey =
  | "age"
  | "bmi"
  | "waist"
  | "physicalActivity"
  | "diet"
  | "antihypertensive"
  | "highGlucose"
  | "familyHistory";

/** 可改变条目：生活方式类，用户有能力改变 */
export const MODIFIABLE_KEYS: readonly ScoreKey[] = [
  "bmi",
  "waist",
  "physicalActivity",
  "diet",
];

/** 不可改变条目：年龄、既往史、家族史 */
export const FIXED_KEYS: readonly ScoreKey[] = [
  "age",
  "highGlucose",
  "familyHistory",
];

// 降压药条目既不是纯生活方式、也不是纯不可改变，单独列出，不纳入「可回收」。
export const ANTIHYPERTENSIVE_KEY: ScoreKey = "antihypertensive";

/**
 * 10 年发病风险（%）分层的性别映射，来源 Lindström 2010。
 * very-high 一档官方口径约为 50%，取 50 用于展示。
 */
const RISK_PERCENT: Record<RiskBand, { male: number; female: number }> = {
  "very-low": { male: 0.3, female: 0.1 },
  low: { male: 0.8, female: 0.4 },
  moderate: { male: 2.6, female: 2.2 },
  high: { male: 23.1, female: 14.1 },
  "very-high": { male: 50, female: 50 },
};

function ageScore(age: number): number {
  if (age < 45) return 0;
  if (age <= 54) return 2;
  if (age <= 64) return 3;
  return 4;
}

function bmiScore(bmi: number): number {
  if (bmi < 25) return 0;
  if (bmi < 30) return 1;
  return 3;
}

function waistScore(waistCm: number, sex: Sex): number {
  if (sex === "male") {
    if (waistCm < 94) return 0;
    if (waistCm <= 102) return 3;
    return 4;
  }
  if (waistCm < 80) return 0;
  if (waistCm <= 88) return 3;
  return 4;
}

function familyHistoryScore(familyHistory: FamilyHistory): number {
  switch (familyHistory) {
    case "none":
      return 0;
    case "second":
      return 3;
    case "first":
      return 5;
  }
}

function bandOf(score: number): RiskBand {
  if (score <= 3) return "very-low";
  if (score <= 8) return "low";
  if (score <= 12) return "moderate";
  if (score <= 20) return "high";
  return "very-high";
}

function riskInfo(score: number, sex: Sex): RiskBandInfo {
  const band = bandOf(score);
  const tenYearRiskPercent = RISK_PERCENT[band][sex];
  return { band, tenYearRiskPercent };
}

/** 逐条计算评分，返回完整明细。 */
export function scoreFindrisc(input: FindriscInput): Record<ScoreKey, number> {
  const breakdown: Record<ScoreKey, number> = {
    age: ageScore(input.age),
    bmi: bmiScore(input.bmi),
    waist: waistScore(input.waistCm, input.sex),
    physicalActivity: input.physicallyActive ? 0 : 2,
    diet: input.eatsVegetablesDaily ? 0 : 1,
    antihypertensive: input.onAntihypertensive ? 2 : 0,
    highGlucose: input.historyOfHighGlucose ? 5 : 0,
    familyHistory: familyHistoryScore(input.familyHistory),
  };
  return breakdown;
}

/**
 * 计算 FINDRISC 总分、风险分层，以及「可回收风险」反事实。
 *
 * 反事实定义：把可改变条目（BMI、腰围、体力活动、饮食）全部设为最佳状态
 * （0 分），其余条目不动，重算总分。差出来的分数就是「可回收」的部分。
 */
export function evaluateFindrisc(input: FindriscInput): FindriscResult {
  const breakdown = scoreFindrisc(input);

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const modifiableScore = MODIFIABLE_KEYS.reduce(
    (sum, key) => sum + breakdown[key],
    0,
  );

  const bestAchievableScore = score - modifiableScore;

  return {
    score,
    breakdown,
    current: riskInfo(score, input.sex),
    modifiableScore,
    bestAchievableScore,
    best: riskInfo(bestAchievableScore, input.sex),
    reclaimablePoints: modifiableScore,
  };
}
