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
  /**
   * 被清洗过的字段名。空数组表示输入干净。
   * 出现任何一项时，界面应当当作「算不了」处理（显示「—」），
   * 而不是把一个用兜底值算出来的数字当成用户的风险。
   */
  sanitized: string[];
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

/**
 * 把脏输入夹回模型范围，并记下动过哪些字段。
 *
 * 夹值不是为了"算出一个数"，而是为了**不产生 NaN**：
 * NaN 一旦进了 logit，界面会显示「NaN%」——比显示「—」糟糕得多。
 * 调用方（页面）看到 sanitized 非空就该停止展示风险。
 */
function sanitize(input: PlcoInput): { v: PlcoInput; sanitized: string[] } {
  const sanitized: string[] = [];
  const num = (raw: number, min: number, max: number, name: string): number => {
    if (!Number.isFinite(raw)) {
      sanitized.push(name);
      return (min + max) / 2;
    }
    if (raw < min) {
      sanitized.push(name);
      return min;
    }
    if (raw > max) {
      sanitized.push(name);
      return max;
    }
    return raw;
  };

  const race = input.race in PLCO_COEF.race ? input.race : "white";
  if (race !== input.race) sanitized.push("race");

  const education = num(input.education, 1, 6, "education") as PlcoInput["education"];

  return {
    v: {
      ...input,
      race,
      education,
      age: num(input.age, PLCO_RANGE.minAge, PLCO_RANGE.maxAge, "age"),
      bmi: num(input.bmi, 10, 60, "bmi"),
      cigarettesPerDay: num(input.cigarettesPerDay, 0, 80, "cigarettesPerDay"),
      smokingYears: num(input.smokingYears, 0, 70, "smokingYears"),
      quitYears: num(input.quitYears, 0, 60, "quitYears"),
    },
    sanitized,
  };
}

export function evaluatePlco(rawInput: PlcoInput): PlcoResult {
  const { v: input, sanitized } = sanitize(rawInput);
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
    outOfRange: rawInput.age < PLCO_RANGE.minAge || rawInput.age > PLCO_RANGE.maxAge,
    sanitized,
  };
}

/**
 * 戒烟反事实：家族史改不了，吸烟这几项能改 —— 这就是"可回收"在肺癌上的版本。
 *
 * 关键约束：**同一时点比较**。把"现在 6 年风险"和"5 年后的 6 年风险"直接比是错的——
 * 那样年龄也在长（5 年 × 0.0779 的对数优势），会把戒烟的收益整个盖过去
 * （第一版就这么写错了，测试当场抓到：戒烟 5 年后反而更高）。
 *
 * 所以这里回答的是「如果当初早点戒」：
 *  - now        ：按现在的样子
 *  - quitNow    ：现在立刻戒（年龄不变，戒烟年数 0）
 *  - quit5yAgo  ：5 年前就戒了（年龄不变，吸烟年限 −5，戒烟年数 +5）
 * 只动模型里真实存在的变量，不引入任何模型外因素。
 */
export interface QuitCounterfactual {
  /** 当前 6 年风险 */
  now: number;
  /** 现在立刻戒烟、其余不变 */
  quitNow: number;
  /** 如果 5 年前就戒了（同一时点，吸烟年限相应少 5 年） */
  quit5yAgo: number | null;
}

export function quitSmokingCounterfactual(input: PlcoInput): QuitCounterfactual {
  const now = evaluatePlco(input).risk;

  if (input.smokingStatus === "current") {
    const quitNow = evaluatePlco({ ...input, smokingStatus: "former", quitYears: 0 }).risk;
    const quit5yAgo =
      input.smokingYears >= 5
        ? evaluatePlco({
            ...input,
            smokingStatus: "former",
            smokingYears: input.smokingYears - 5,
            quitYears: input.quitYears + 5,
          }).risk
        : null;
    return { now, quitNow, quit5yAgo };
  }

  // 已经戒烟的人：如果当初再早 5 年戒
  const quit5yAgo =
    input.smokingYears >= 5
      ? evaluatePlco({
          ...input,
          smokingYears: input.smokingYears - 5,
          quitYears: input.quitYears + 5,
        }).risk
      : null;
  return { now, quitNow: now, quit5yAgo };
}
