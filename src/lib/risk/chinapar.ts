/**
 * China-PAR 10 年 ASCVD 风险方程
 *
 * 来源（两源交叉一致，缺一不可）：
 *  1. Yang X, et al. Circulation. 2016;134:1430-1440. Supplemental Table 1
 *     （https://www.cvdrisk.com.cn/uploadedFile/20171227114818843.pdf）
 *  2. T/JPMA 024-2024《社区人群心血管病风险筛查技术规范》附录 C/D，
 *     转引自《中国心血管病风险评估和管理指南》(中国循环杂志, 2019, 34(1):4-28)
 *
 * 方程：风险 = 1 - S10 ^ exp(X - mean)
 *   X 为各变量「系数 × 值」之和；S10 为基线生存率（男 0.9707 / 女 0.9851）。
 *
 * 注意：Circulation 补充材料表格里女性基线生存率印作 0.99（两位小数），
 * 与论文自己的示例（女性 60 岁示例应为 10.1%）矛盾；按正文 Table 2 的
 * 四个年龄点反推为 0.9851，与 2019 中国指南/团标完全一致。实现以
 * 0.9851 为准，并用 Table 2 全部 8 个点做回归测试。
 */

export type AscvdBand = "low" | "medium" | "high";

export interface ChinaparInput {
  /** 年龄（岁），方程适用 35–74 岁（推导队列范围），越界值只做提示不拒绝 */
  age: number;
  sex: "male" | "female";
  /** 平均收缩压 mmHg */
  sbp: number;
  /** 两周内服用降压药（true 走「药物治疗收缩压」分支） */
  onTreatment: boolean;
  /** 总胆固醇 mmol/L（国内化验单口径，内部转 mg/dL） */
  totalCholesterolMmol: number;
  /** 高密度脂蛋白胆固醇 mmol/L */
  hdlMmol: number;
  /** 腰围 cm */
  waistCm: number;
  smoker: boolean;
  diabetic: boolean;
  /** 地域：北方（长江为界）= true */
  northern: boolean;
  /** 城乡：城市 = true（仅男性方程使用） */
  urban: boolean;
  /**
   * 心血管病家族史：父母、兄弟姊妹中至少一人患心肌梗死或脑卒中
   * （指南定义，见 T/JPMA 024-2024 B.6；仅男性方程使用，但两性都展示）
   */
  familyHistory: boolean;
}

interface Coef {
  age: number;
  treatedSbp: number;
  untreatedSbp: number;
  tc: number;
  hdl: number;
  waist: number;
  smoker: number;
  diabetes: number;
  region: number;
  urban: number | null;
  familyHistory: number | null;
  ageTreatedSbp: number;
  ageUntreatedSbp: number;
  ageSmoker: number | null;
  ageFamilyHistory: number | null;
  mean: number;
  baselineSurvival: number;
}

/** 三位小数版本（2019 中国指南 / T/JPMA 024-2024 附录 C）。 */
const MALE: Coef = {
  age: 31.967,
  treatedSbp: 27.388,
  untreatedSbp: 26.148,
  tc: 0.621,
  hdl: -0.695,
  waist: -0.712,
  smoker: 3.955,
  diabetes: 0.357,
  region: 0.475,
  urban: -0.164,
  familyHistory: 6.221,
  ageTreatedSbp: -6.018,
  ageUntreatedSbp: -5.731,
  ageSmoker: -0.939,
  ageFamilyHistory: -1.534,
  mean: 140.68,
  baselineSurvival: 0.9707,
};

const FEMALE: Coef = {
  age: 24.874,
  treatedSbp: 20.709,
  untreatedSbp: 19.982,
  tc: 0.058,
  hdl: -0.217,
  waist: 1.475,
  smoker: 0.495,
  diabetes: 0.567,
  region: 0.544,
  urban: null,
  familyHistory: null,
  ageTreatedSbp: -4.528,
  ageUntreatedSbp: -4.360,
  ageSmoker: null,
  ageFamilyHistory: null,
  mean: 117.26,
  baselineSurvival: 0.9851,
};

/** mmol/L → mg/dL（T/JPMA 024-2024 注：1 mmol/L = 38.6 mg/dL） */
const MMOL_TO_MGDL = 38.6;

export interface ChinaparResult {
  /** 10 年 ASCVD 风险（0–1） */
  risk: number;
  /** 分层：<5% 低危 / 5–10% 中危 / ≥10% 高危 */
  band: AscvdBand;
  /**
   * 家族史对风险的影响（男性方程）：有 vs 无家族史的风险差，有符号。
   * 注意方程的年龄交互项 6.221−1.534×ln(年龄)：约 61 岁以上为负——
   * 这是论文方程的原始行为（家族史对年轻人的边际影响更大）。
   * 女性方程不含家族史项，返回 null。
   */
  familyHistoryDelta: number | null;
}

export function evaluateChinapar(input: ChinaparInput): ChinaparResult {
  const c = input.sex === "male" ? MALE : FEMALE;
  const lnAge = Math.log(input.age);
  const lnSbp = Math.log(input.sbp);
  const lnTc = Math.log(input.totalCholesterolMmol * MMOL_TO_MGDL);
  const lnHdl = Math.log(input.hdlMmol * MMOL_TO_MGDL);
  const lnWaist = Math.log(input.waistCm);

  let x = c.age * lnAge + c.tc * lnTc + c.hdl * lnHdl + c.waist * lnWaist;

  // 收缩压：治疗/未治疗二选一，各带年龄交互项
  if (input.onTreatment) {
    x += (c.treatedSbp + c.ageTreatedSbp * lnAge) * lnSbp;
  } else {
    x += (c.untreatedSbp + c.ageUntreatedSbp * lnAge) * lnSbp;
  }

  // 吸烟：男女方程都含主效应；年龄交互项只有男性方程有
  // （补充材料 Table 1：女性 Ln(age)×Current smoker 为 N/A）。
  // 之前要求交互项非空才计入，导致女性吸烟者风险被系统性低估——已修。
  if (input.smoker) {
    x += c.smoker;
    if (c.ageSmoker !== null) x += c.ageSmoker * lnAge;
  }
  if (input.diabetic) x += c.diabetes;
  if (input.northern) x += c.region;
  if (input.urban && c.urban !== null) x += c.urban;

  const withFh =
    input.familyHistory && c.familyHistory !== null && c.ageFamilyHistory !== null
      ? x + c.familyHistory + c.ageFamilyHistory * lnAge
      : null;

  const y = Math.exp(x - c.mean);
  const riskBase = 1 - Math.pow(c.baselineSurvival, y);

  const riskWithFh =
    withFh === null ? null : 1 - Math.pow(c.baselineSurvival, Math.exp(withFh - c.mean));

  const risk = riskWithFh === null ? riskBase : riskWithFh;

  // 分层必须基于最终返回的风险（含家族史），否则会出现
  // 「显示 11% 却标中危」的矛盾（男性家族史把风险推过 10% 阈值时）。
  let band: AscvdBand;
  if (risk < 0.05) band = "low";
  else if (risk < 0.1) band = "medium";
  else band = "high";

  return {
    risk,
    band,
    familyHistoryDelta:
      riskWithFh === null ? null : riskWithFh - riskBase,
  };
}

/** 分层中文名。 */
export const ASCVD_BAND_LABEL: Record<AscvdBand, string> = {
  low: "低危",
  medium: "中危",
  high: "高危",
};
