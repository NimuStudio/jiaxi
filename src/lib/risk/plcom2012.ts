/**
 * PLCOm2012 —— 6 年肺癌风险模型（Tammemägi 2013, NEJM）
 *
 * 来源：Tammemägi MC, Katki HA, Hocking WG, et al.
 *       Selection Criteria for Lung-Cancer Screening.
 *       N Engl J Med 2013;368(8):728-736. doi:10.1056/NEJMoa1211776
 *       表 2（β 系数与常数项）、表注（中心化取值与计算步骤）。
 * 原文 PDF 存于 docs/NEJMoa1211776.pdf（不入库）。
 *
 * 计算步骤照原文表注：
 *   logit = 常数项
 *         + β_age × (age − 62)
 *         + β_race（分类变量，乘以 0/1）
 *         + β_edu × (education − 4)
 *         + β_bmi × (bmi − 27)
 *         + β_copd × copd
 *         + β_cancer × priorCancer
 *         + β_family × familyLungCancer
 *         + β_current × (smokingStatus === current)
 *         + β_intensity × ( (cig/day ÷ 10)^-1 − 0.4021541613 )
 *         + β_duration × (smokingYears − 27)
 *         + β_quit × (quitYears − 10)
 *   6 年风险 = e^logit / (1 + e^logit)
 *
 * 适用边界（论文明确）：只对"曾经吸烟者"建模；年龄 55–74 之外的表现不确定。
 */

export type PlcoRace =
  | "white"
  | "black"
  | "hispanic"
  | "asian"
  | "aian"
  | "nhpi";

export type PlcoEducation = 1 | 2 | 3 | 4 | 5 | 6;

export interface PlcoInput {
  age: number;
  race: PlcoRace;
  /** 教育层级 1–6（见原文表注） */
  education: PlcoEducation;
  bmi: number;
  copd: boolean;
  /** 既往恶性肿瘤（不含肺癌） */
  priorCancer: boolean;
  familyLungCancer: boolean;
  smokingStatus: "current" | "former";
  /** 平均每天吸烟支数 */
  cigarettesPerDay: number;
  /** 吸烟年限 */
  smokingYears: number;
  /** 戒烟年数；仍在吸烟填 0 */
  quitYears: number;
}

/** 表 2 的 β 系数，逐项对应原文 */
export const PLCO_COEF = {
  constant: -4.532506,
  age: 0.0778868,
  education: -0.0812744,
  bmi: -0.0274194,
  copd: 0.3553063,
  priorCancer: 0.4589971,
  family: 0.587185,
  currentSmoker: 0.2597431,
  intensity: -1.822606,
  duration: 0.0317321,
  quitTime: -0.0308572,
  race: {
    white: 0,
    black: 0.3944778,
    hispanic: -0.7434744,
    asian: -0.466585,
    aian: 0,
    nhpi: 1.027152,
  } as Record<PlcoRace, number>,
} as const;

/** 表注给出的中心化取值 */
export const PLCO_CENTER = {
  age: 62,
  education: 4,
  bmi: 27,
  duration: 27,
  quitTime: 10,
  intensity: 0.4021541613,
} as const;

/** 吸烟强度的非线性变换： (支/天 ÷ 10) ^ -1，再减去中心值 */
export function intensityTerm(cigarettesPerDay: number): number {
  const per10 = cigarettesPerDay / 10;
  if (per10 <= 0) return 0;
  return 1 / per10 - PLCO_CENTER.intensity;
}

export interface PlcoResult {
  /** 6 年肺癌风险（0–1） */
  risk: number;
  logit: number;
  /** 各变量的对数优势贡献，便于界面逐项展示 */
  terms: Record<string, number>;
  /** 是否超出模型验证人群 */
  outOfRange: boolean;
}

export const PLCO_RANGE = { minAge: 40, maxAge: 85, validatedAge: [55, 74] as const };

/**
 * 模型只对「曾经吸烟者」建模（原文的建模人群）。
 * 吸烟年限为 0 的人不在这个人群里，算出来的数字没有意义 —— 界面上不给数。
 */
export function isEverSmoker(input: Pick<PlcoInput, "smokingYears" | "cigarettesPerDay">): boolean {
  return input.smokingYears > 0 && input.cigarettesPerDay > 0;
}

/**
 * 风险百分比展示。
 *
 * 直接用 toFixed(1) 会把 0.0019% 印成 "0.0%" —— 看起来像"零风险"，
 * 掩盖了"有风险但很低"这个事实。低于 0.1% 时换更细的刻度。
 */
export function formatRiskPercent(risk: number): string {
  const pct = risk * 100;
  if (!Number.isFinite(pct)) return "—";
  if (pct <= 0) return "0";
  if (pct < 0.01) return "<0.01";
  if (pct < 0.1) return pct.toFixed(2);
  return pct.toFixed(1);
}

export function evaluatePlco(input: PlcoInput): PlcoResult {
  const c = PLCO_COEF;
  const terms: Record<string, number> = {
    constant: c.constant,
    age: c.age * (input.age - PLCO_CENTER.age),
    race: c.race[input.race] ?? 0,
    education: c.education * (input.education - PLCO_CENTER.education),
    bmi: c.bmi * (input.bmi - PLCO_CENTER.bmi),
    copd: input.copd ? c.copd : 0,
    priorCancer: input.priorCancer ? c.priorCancer : 0,
    family: input.familyLungCancer ? c.family : 0,
    currentSmoker: input.smokingStatus === "current" ? c.currentSmoker : 0,
    intensity: c.intensity * intensityTerm(input.cigarettesPerDay),
    duration: c.duration * (input.smokingYears - PLCO_CENTER.duration),
    quitTime: c.quitTime * (input.quitYears - PLCO_CENTER.quitTime),
  };

  const logit = Object.values(terms).reduce((a, b) => a + b, 0);
  const risk = 1 / (1 + Math.exp(-logit));

  return {
    risk,
    logit,
    terms,
    outOfRange: input.age < PLCO_RANGE.minAge || input.age > PLCO_RANGE.maxAge,
  };
}
