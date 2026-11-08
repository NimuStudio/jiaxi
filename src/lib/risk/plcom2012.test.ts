import { describe, expect, it } from "vitest";
import {
  evaluatePlco,
  formatRiskPercent,
  intensityTerm,
  isEverSmoker,
  PLCO_COEF,
  PLCO_CENTER,
  type PlcoInput,
} from "./plcom2012";

/**
 * 校验口径说明（重要）：
 * 论文正文与表 2 没有给出"某个人算出来是多少"的算例，只给了 β、常数项、
 * 中心化取值与 AUC/校准统计。因此这里做的是**公式级复算**：
 * 用一段独立的手算（Python，逐项展开）得到期望值，再与本实现比对，
 * 保证系数抄写与中心化没有走样。它不能证明模型本身对，只能证明我们如实实现了论文。
 */

const base: PlcoInput = {
  age: 65,
  race: "white",
  education: 4,
  bmi: 26,
  copd: false,
  priorCancer: false,
  familyLungCancer: true,
  smokingStatus: "current",
  cigarettesPerDay: 20,
  smokingYears: 35,
  quitYears: 0,
};

function withPatch(patch: Partial<PlcoInput>): PlcoInput {
  return { ...base, ...patch };
}

describe("PLCOm2012 · 公式复算", () => {
  it("算例 A：65 岁白人男性，现吸 20 支/天 35 年，有家族史", () => {
    const r = evaluatePlco(base);
    expect(r.logit).toBeCloseTo(-3.040404, 6);
    expect(r.risk * 100).toBeCloseTo(4.5634, 4);
  });

  it("算例 B：与 A 相同，但已戒烟 10 年", () => {
    const r = evaluatePlco(withPatch({ smokingStatus: "former", quitYears: 10 }));
    expect(r.logit).toBeCloseTo(-3.608719, 6);
    expect(r.risk * 100).toBeCloseTo(2.6372, 4);
  });

  it("算例 C：60 岁白人女性，曾吸 30 支/天 20 年，戒烟 15 年，无其他危险因素", () => {
    const r = evaluatePlco(
      withPatch({
        age: 60,
        bmi: 24,
        familyLungCancer: false,
        smokingStatus: "former",
        cigarettesPerDay: 30,
        smokingYears: 20,
        quitYears: 15,
      }),
    );
    expect(r.logit).toBeCloseTo(-4.856999, 6);
    expect(r.risk * 100).toBeCloseTo(0.7714, 4);
  });
});

describe("PLCOm2012 · 方向性", () => {
  it("年龄越大风险越高", () => {
    const young = evaluatePlco(withPatch({ age: 55 })).risk;
    const old = evaluatePlco(withPatch({ age: 75 })).risk;
    expect(old).toBeGreaterThan(young);
  });

  it("现吸高于已戒（戒烟年数相同）", () => {
    const current = evaluatePlco(withPatch({ smokingStatus: "current", quitYears: 0 })).risk;
    const former = evaluatePlco(withPatch({ smokingStatus: "former", quitYears: 10 })).risk;
    expect(current).toBeGreaterThan(former);
  });

  it("戒烟越久风险越低", () => {
    const q5 = evaluatePlco(withPatch({ smokingStatus: "former", quitYears: 5 })).risk;
    const q20 = evaluatePlco(withPatch({ smokingStatus: "former", quitYears: 20 })).risk;
    expect(q20).toBeLessThan(q5);
  });

  it("有家族史高于无家族史", () => {
    const yes = evaluatePlco(withPatch({ familyLungCancer: true })).risk;
    const no = evaluatePlco(withPatch({ familyLungCancer: false })).risk;
    expect(yes).toBeGreaterThan(no);
  });

  it("COPD 与既往肿瘤史各自抬高风险", () => {
    const none = evaluatePlco(base).risk;
    expect(evaluatePlco(withPatch({ copd: true })).risk).toBeGreaterThan(none);
    expect(evaluatePlco(withPatch({ priorCancer: true })).risk).toBeGreaterThan(none);
  });

  it("吸烟年限越长风险越高", () => {
    const short = evaluatePlco(withPatch({ smokingYears: 15 })).risk;
    const long = evaluatePlco(withPatch({ smokingYears: 45 })).risk;
    expect(long).toBeGreaterThan(short);
  });
});

describe("PLCOm2012 · 吸烟强度的非线性项", () => {
  it("变换值与表注一致：20 支/天 → 0.5 − 0.4021541613", () => {
    expect(intensityTerm(20)).toBeCloseTo(0.5 - PLCO_CENTER.intensity, 10);
  });

  it("10 支/天时变换值为 1 − 0.4021541613", () => {
    expect(intensityTerm(10)).toBeCloseTo(1 - PLCO_CENTER.intensity, 10);
  });

  it("强度越高风险越高，但走的是非线性路径（不是线性叠加）", () => {
    const light = evaluatePlco(withPatch({ cigarettesPerDay: 10 })).risk;
    const mid = evaluatePlco(withPatch({ cigarettesPerDay: 20 })).risk;
    const heavy = evaluatePlco(withPatch({ cigarettesPerDay: 40 })).risk;
    expect(PLCO_COEF.intensity).toBeLessThan(0); // 系数为负，作用在 1/x 变换上
    expect(mid).toBeGreaterThan(light);
    expect(heavy).toBeGreaterThan(mid);
    // 线性外推会给出更大的差距；这里因为 1/x 递减，增量应当收敛
    expect(heavy - mid).toBeLessThan(mid - light);
  });
});

describe("PLCOm2012 · 适用边界", () => {
  it("年龄在 40–85 内不标记越界", () => {
    expect(evaluatePlco(withPatch({ age: 65 })).outOfRange).toBe(false);
  });

  it("超出 40–85 标记越界", () => {
    expect(evaluatePlco(withPatch({ age: 30 })).outOfRange).toBe(true);
    expect(evaluatePlco(withPatch({ age: 90 })).outOfRange).toBe(true);
  });
});

describe("PLCOm2012 · 展示与适用人群", () => {
  it("极低风险不会被印成 0.0%", () => {
    expect(formatRiskPercent(0.000019)).toBe("<0.01");
    expect(formatRiskPercent(0.0005)).toBe("0.05");
    expect(formatRiskPercent(0.0123)).toBe("1.2");
  });

  it("零风险与非法值", () => {
    expect(formatRiskPercent(0)).toBe("0");
    expect(formatRiskPercent(Number.NaN)).toBe("—");
  });

  it("吸烟年限为 0 视为从不吸烟，不在模型人群内", () => {
    expect(isEverSmoker({ smokingYears: 0, cigarettesPerDay: 20 })).toBe(false);
    expect(isEverSmoker({ smokingYears: 30, cigarettesPerDay: 20 })).toBe(true);
  });
});
