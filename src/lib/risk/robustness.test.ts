import { describe, expect, it } from "vitest";
import { evaluateFindrisc } from "./findrisc";
import { evaluateChinapar } from "./chinapar";
import { evaluatePlco, type PlcoInput } from "./plcom2012";

/**
 * 鲁棒性：脏输入不能算出 NaN / Infinity，也不能抛异常。
 *
 * 这些值用户点不出来，但会从「云端同步、旧版本本地缓存、导入的化验单」进来 ——
 * 一旦变成 NaN，页面上就会出现 "NaN%"。
 */

const bad = [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1e9];

describe("FINDRISC 脏输入", () => {
  for (const v of bad) {
    it(`bmi=${v} 不产生 NaN`, () => {
      const r = evaluateFindrisc({
        age: 48, bmi: v, waistCm: 96, sex: "male",
        physicallyActive: false, eatsVegetablesDaily: false,
        onAntihypertensive: true, historyOfHighGlucose: false, familyHistory: "first",
      });
      expect(Number.isFinite(r.score)).toBe(true);
      expect(Number.isFinite(r.current.tenYearRiskPercent)).toBe(true);
      expect(Number.isFinite(r.best.tenYearRiskPercent)).toBe(true);
    });
  }

  it("age=NaN 不抛异常", () => {
    expect(() =>
      evaluateFindrisc({
        age: Number.NaN, bmi: 27, waistCm: 96, sex: "male",
        physicallyActive: true, eatsVegetablesDaily: true,
        onAntihypertensive: false, historyOfHighGlucose: false, familyHistory: "none",
      }),
    ).not.toThrow();
  });
});

describe("China-PAR 脏输入", () => {
  const base = {
    sex: "male" as const, age: 60, sbp: 130, totalCholesterolMmol: 5.4, hdlMmol: 1.4,
    waistCm: 80, northern: true, urban: true,
    onTreatment: false, smoker: false, diabetic: false, familyHistory: false,
  };

  it("正常输入能算出结果", () => {
    const r = evaluateChinapar(base);
    expect(r).not.toBeNull();
    expect(Number.isFinite(r!.risk)).toBe(true);
  });

  for (const field of ["age", "sbp", "totalCholesterolMmol", "hdlMmol", "waistCm"] as const) {
    it(`${field}=NaN 时返回 null（页面显示「—」而不是 NaN%）`, () => {
      expect(evaluateChinapar({ ...base, [field]: Number.NaN })).toBeNull();
    });
    it(`${field}=0 时返回 null（log(0) 会变成 -Infinity）`, () => {
      expect(evaluateChinapar({ ...base, [field]: 0 })).toBeNull();
    });
  }
});

describe("PLCOm2012 脏输入", () => {
  const base: PlcoInput = {
    age: 62, race: "white", education: 3, bmi: 24, copd: false, priorCancer: false,
    familyLungCancer: false, smokingStatus: "current", cigarettesPerDay: 20,
    smokingYears: 30, quitYears: 0,
  };

  it("正常输入风险在 0–1 之间", () => {
    const r = evaluatePlco(base);
    expect(r.risk).toBeGreaterThan(0);
    expect(r.risk).toBeLessThan(1);
  });

  for (const field of ["age", "bmi", "cigarettesPerDay", "smokingYears", "quitYears"] as const) {
    it(`${field}=NaN 时风险仍是有限数，并标记为脏输入`, () => {
      const r = evaluatePlco({ ...base, [field]: Number.NaN });
      expect(Number.isFinite(r.risk)).toBe(true);
      expect(r.sanitized).toContain(field);
    });
  }

  it("支数为 0（除零）不产生 Infinity", () => {
    const r = evaluatePlco({ ...base, cigarettesPerDay: 0 });
    expect(Number.isFinite(r.risk)).toBe(true);
  });

  it("年龄 1e9 被夹到模型上限，不出 Infinity", () => {
    const r = evaluatePlco({ ...base, age: 1e9 });
    expect(Number.isFinite(r.risk)).toBe(true);
    expect(r.sanitized).toContain("age");
  });

  it("种族传了未知值 → 回落到参照组并标记", () => {
    const r = evaluatePlco({ ...base, race: "martian" as never });
    expect(r.sanitized).toContain("race");
    expect(Number.isFinite(r.risk)).toBe(true);
  });
});
