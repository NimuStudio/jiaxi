import { describe, expect, it } from "vitest";
import { evaluateChinapar, type ChinaparInput } from "./chinapar";

/**
 * 验证点来自论文正文 Table 2（同一示例人，不同年龄）：
 *   Yang X, et al. Circulation. 2016;134:1430-1440.
 * 示例：未治疗 SBP 130 mmHg、TC 210 mg/dL、HDL-C 55 mg/dL、腰围 80 cm、
 *       不吸烟、有糖尿病、北方城市、无心血管病家族史。
 *
 * 210 mg/dL = 5.44 mmol/L；55 mg/dL = 1.42 mmol/L（÷38.6）。
 */
const EXAMPLE: ChinaparInput = {
  age: 60,
  sex: "male",
  sbp: 130,
  onTreatment: false,
  totalCholesterolMmol: 210 / 38.6,
  hdlMmol: 55 / 38.6,
  waistCm: 80,
  smoker: false,
  diabetic: true,
  northern: true,
  urban: true,
  familyHistory: false,
};

const AGES: Array<[number, number, number]> = [
  // [年龄, 男性风险%, 女性风险%]
  [40, 2.2, 2.4],
  [50, 5.4, 5.4],
  [60, 11.0, 10.1],
  [70, 19.6, 17.1],
];

describe("China-PAR：论文 Table 2 全部 8 个验证点", () => {
  for (const [age, menPct, womenPct] of AGES) {
    it(`男性 ${age} 岁示例 ≈ ${menPct}%`, () => {
      const r = evaluateChinapar({ ...EXAMPLE, age, sex: "male" });
      expect(r).not.toBeNull();
      // 论文给到 1 位小数，本实现系数取 4 位有效数字，允许 0.35 个百分点偏差
      expect(Math.abs(r!.risk * 100 - menPct)).toBeLessThanOrEqual(0.35);
    });
    it(`女性 ${age} 岁示例 ≈ ${womenPct}%`, () => {
      const r = evaluateChinapar({ ...EXAMPLE, age, sex: "female" });
      expect(r).not.toBeNull();
      expect(Math.abs(r!.risk * 100 - womenPct)).toBeLessThanOrEqual(0.35);
    });
  }
});

describe("China-PAR：结构与边界", () => {
  it("男性家族史抬高风险（45 岁示例；方程的年龄交互使 58 岁后该项转负）", () => {
    const base = evaluateChinapar({ ...EXAMPLE, age: 45, familyHistory: false });
    const fh = evaluateChinapar({ ...EXAMPLE, age: 45, familyHistory: true });
    expect(fh!.risk).toBeGreaterThan(base!.risk);
    expect(fh!.familyHistoryDelta).toBeGreaterThan(0);
  });

  it("女性方程不含家族史项，delta 为 null 且风险不变", () => {
    const a = evaluateChinapar({ ...EXAMPLE, sex: "female", familyHistory: false });
    const b = evaluateChinapar({ ...EXAMPLE, sex: "female", familyHistory: true });
    expect(b!.risk).toBeCloseTo(a!.risk, 12);
    expect(b!.familyHistoryDelta).toBeNull();
  });

  it("分层阈值：<5% 低危、5–10% 中危、≥10% 高危", () => {
    expect(evaluateChinapar({ ...EXAMPLE, age: 40 })!.band).toBe("low");
    expect(evaluateChinapar({ ...EXAMPLE, age: 50 })!.band).toBe("medium");
    expect(evaluateChinapar({ ...EXAMPLE, age: 70 })!.band).toBe("high");
  });

  it("治疗与未治疗收缩压走不同分支", () => {
    const treated = evaluateChinapar({ ...EXAMPLE, onTreatment: true });
    const untreated = evaluateChinapar({ ...EXAMPLE, onTreatment: false });
    expect(treated!.risk).not.toBeCloseTo(untreated!.risk, 6);
  });

  it("女性方程也计入吸烟（补充材料 Table 1：女性系数 0.49、无年龄交互）", () => {
    const nonsmoker = evaluateChinapar({ ...EXAMPLE, sex: "female", smoker: false });
    const smoker = evaluateChinapar({ ...EXAMPLE, sex: "female", smoker: true });
    // 之前实现要求年龄交互项非空才计入吸烟，女性方程没有交互项，
    // 导致女性吸烟风险被系统性低估——此测试锁住该修复。
    expect(smoker!.risk).toBeGreaterThan(nonsmoker!.risk);
  });

  it("分层与返回的风险一致（含家族史后的风险跨越阈值时）", () => {
    // 50 岁示例：基础风险约 5.4%（中危下沿），男性加家族史后应跨过阈值
    const r = evaluateChinapar({ ...EXAMPLE, age: 50, familyHistory: true });
    expect(r).not.toBeNull();
    if (r!.risk >= 0.05 && r!.risk < 0.1) {
      expect(r!.band).toBe("medium");
    } else if (r!.risk >= 0.1) {
      expect(r!.band).toBe("high");
    } else {
      expect(r!.band).toBe("low");
    }
    // 更直接的验证：不存在「返回 11% 却标中危」的组合
    expect(r!.risk < 0.1 || r!.band === "high").toBe(true);
  });
});
