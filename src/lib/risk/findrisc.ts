/**
 * FINDRISC — 芬兰糖尿病风险评分（Finnish Diabetes Risk Score）
 *
 * 【文献核实状态】2026-11-04 逐条核对，见 docs/references.md
 *
 * 1. 量表原始出处（已核实，PMID 12610029 / DOI 10.2337/diacare.26.3.725）：
 *    Lindström J, Tuomilehto J. The diabetes risk score: a practical tool to
 *    predict type 2 diabetes risk. Diabetes Care. 2003;26(3):725-731.
 *    ⚠️ 该原文为 7 个变量、总分 0–20 分。
 *
 * 2. 本实现采用 8 条目、总分 0–26 分的现行版本（腰围单独计分），
 *    该版本广泛用于 IDF 及各国临床指南，例如加拿大预防保健工作组（CTFPHC）
 *    的 FINDRISC 临床工具。**因此不能把 0–26 的分值直接归到 2003 原文名下。**
 *
 * 3. 风险分层与 10 年风险值（1% / 4% / 17% / 33% / 50%），
 *    经三份独立来源交叉核对一致：
 *    - SciELO 期刊 FINDRISC 验证研究（八条目、0–26 分、五档、1/25、1/6）
 *    - Springer《Cardiovascular Diabetology》2024（明确给出 1%、4%、17%、33%、50%）
 *    - 加拿大预防保健工作组（CTFPHC）官方工具页
 *    分档：0–6 低 / 7–11 轻度升高 / 12–14 中等 / 15–20 高 / 21–26 极高。
 *
 * 【本文件不做的事】
 * 不输出「你是同龄人平均的 X 倍」。FINDRISC 是分档评分工具，没有人群基线
 * 比值这个量；倍数只在接入 China-PAR 这类有明确基线风险的方程时才成立。
 */

export type Sex = "male" | "female";
export type FamilyHistory = "none" | "second" | "first";
export type RiskBand =
  | "low"
  | "slightly-elevated"
  | "moderate"
  | "high"
  | "very-high";

export interface FindriscInput {
  /** 年龄（岁） */
  age: number;
  /** 体质指数 BMI（kg/m²） */
  bmi: number;
  /** 腰围（cm，肚脐水平） */
  waistCm: number;
  /** 性别。现行 8 条目版本的风险分层不区分性别，保留字段以备扩展。 */
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
 * 10 年发病风险（%）按分档取值。来源见文件头第 3 条。
 * 取整数值（1/4/17/33/50），不细分性别——现行版本的分层不区分性别。
 */
const RISK_PERCENT: Record<RiskBand, number> = {
  low: 1,
  "slightly-elevated": 4,
  moderate: 17,
  high: 33,
  "very-high": 50,
};

function ageScore(age: number): number {
  if (!Number.isFinite(age)) return 0; // NaN 走比较会落到最高分，必须显式处理
  if (age < 45) return 0;
  if (age <= 54) return 2;
  if (age <= 64) return 3;
  return 4;
}

function bmiScore(bmi: number): number {
  if (!Number.isFinite(bmi)) return 0;
  if (bmi < 25) return 0;
  if (bmi < 30) return 1;
  return 3;
}

function waistScore(waistCm: number, sex: Sex): number {
  if (!Number.isFinite(waistCm)) return 0;
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

/** 分档边界严格对齐文献：0–6 / 7–11 / 12–14 / 15–20 / 21–26。 */
export function bandOf(score: number): RiskBand {
  if (score <= 6) return "low";
  if (score <= 11) return "slightly-elevated";
  if (score <= 14) return "moderate";
  if (score <= 20) return "high";
  return "very-high";
}

function riskInfo(score: number): RiskBandInfo {
  const band = bandOf(score);
  return { band, tenYearRiskPercent: RISK_PERCENT[band] };
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
    current: riskInfo(score),
    modifiableScore,
    bestAchievableScore,
    best: riskInfo(bestAchievableScore),
    reclaimablePoints: modifiableScore,
  };
}
