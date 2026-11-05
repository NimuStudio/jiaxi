import type { ExtractedPerson } from "@/lib/extract/client";

/**
 * 家系 × 暴露因素的提示（规则层，不给概率）。
 *
 * 为什么不做数值：FINDRISC 与 China-PAR 是有发表系数的方程，所以敢报百分比；
 * 而「家族肺癌史 × 吸烟 → 肺癌概率」这类基因-环境交互，缺中国人群可引用的模型。
 * 编一个数字会破坏「每个数字都能点回出处」这条底线，而这次编的是概率，代价更大。
 *
 * 所以这里的每一条都明确说两件事：它是否改变页面上的分数、以及能不能给数字。
 */

export interface ExposureFactorInput {
  smoker: boolean;
  drinker: boolean;
  /** 既往被诊断过慢性支气管炎 / 肺气肿 / 慢阻肺 */
  lungDisease: boolean;
}

export interface ExposureHint {
  id: string;
  level: "attention" | "info";
  title: string;
  body: string;
}

/** 一级亲属 + 肺部相关病种：用于判断"家族底子"是否存在 */
const LUNG_CODES = new Set(["lung-cancer", "copd", "chronic-bronchitis", "asthma"]);

const FIRST_DEGREE = new Set([
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
]);

export function hasFirstDegreeLung(persons: ExtractedPerson[]): boolean {
  return persons.some(
    (p) =>
      FIRST_DEGREE.has(p.relation) &&
      (p.conditions ?? []).some((c) => LUNG_CODES.has(c.code)),
  );
}

export function exposureHints(
  persons: ExtractedPerson[],
  factors: ExposureFactorInput,
): ExposureHint[] {
  const hints: ExposureHint[] = [];
  const familyLung = hasFirstDegreeLung(persons);

  // 唯一给数字的一条：既往肺部疾病 → 肺癌的相对风险，来自已发表的 meta 分析。
  // 注意口径：这是「相对风险」，不是「你未来得肺癌的概率」；而且针对的是本人的既往疾病，
  // 不是家族史。界面上必须把这层区分写清楚。
  if (factors.lungDisease) {
    hints.push({
      id: "lung-disease-rr",
      level: "attention",
      title: "有慢性支气管炎 / 肺气肿 / 慢阻肺史",
      body:
        "已发表的 meta 分析（PLoS ONE 2011）汇总 39 项研究：有既往肺部疾病者的肺癌相对风险约为 " +
        "1.80 倍（95% CI 1.60–2.11）；其中慢阻肺 2.22 倍（1.66–2.97）、肺气肿 2.04 倍（1.72–2.41）、" +
        "慢性支气管炎 1.52 倍（1.25–1.84）。" +
        "这是相对风险，不是你的个人概率——绝对风险还取决于年龄、吸烟量与暴露年限。" +
        "结合吸烟时通常更高，建议与医生讨论是否适合做肺部筛查。",
    });
  }

  if (factors.smoker && familyLung) {
    hints.push({
      id: "lung-family-smoker",
      level: "attention",
      title: "一级亲属有肺部疾病，而你在吸烟",
      body:
        "这类组合通常被认为值得更积极地评估，建议与医生讨论是否适合做肺部影像筛查。" +
        "本项目不给出具体概率：现有的 FINDRISC 与 China-PAR 都不含这一项，" +
        "而「家族史 × 吸烟」的中国人群交互模型我们找不到可引用的来源，宁可不给数字。",
    });
  }

  if (factors.smoker) {
    hints.push({
      id: "smoker-chinapar",
      level: "info",
      title: "吸烟已经被计入心血管风险",
      body:
        "China-PAR 方程里吸烟是独立变量，所以上面的心血管风险已经反映了这一项。" +
        "它同时也是最直接的可改因素：戒烟会同时降低心血管与多种癌症的风险。",
    });
  }

  if (factors.drinker) {
    hints.push({
      id: "drinker-not-in-model",
      level: "info",
      title: "饮酒不在这两个方程里",
      body:
        "FINDRISC 与 China-PAR 都没有饮酒项，所以它不会改变上面的分数。" +
        "把它记录下来是为了让医生看到完整的生活方式，而不是为了让分数更好看。",
    });
  }

  return hints;
}
