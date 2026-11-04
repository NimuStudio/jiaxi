/**
 * FINDRISC 回归测试
 *
 * 这些测试的意义：用「已知答案」逐项核对实现，保证系数没抄错、边界没搞反。
 * 这是答辩时「风险模型可复现性」的直接证据。
 */
import { describe, it, expect } from "vitest";
import {
  scoreFindrisc,
  evaluateFindrisc,
  bandOf,
  type FindriscInput,
} from "./findrisc";

/** 一个全 0 分的基线输入（年轻、健康、无家族史），后续用例在此基础上改单项。 */
function base(overrides: Partial<FindriscInput> = {}): FindriscInput {
  return {
    age: 30,
    bmi: 22,
    waistCm: 80,
    sex: "male",
    physicallyActive: true,
    eatsVegetablesDaily: true,
    onAntihypertensive: false,
    historyOfHighGlucose: false,
    familyHistory: "none",
    ...overrides,
  };
}

describe("FINDRISC 逐项分值（对照 Lindström 2003 评分表）", () => {
  it("年龄", () => {
    expect(scoreFindrisc(base({ age: 44 })).age).toBe(0);
    expect(scoreFindrisc(base({ age: 45 })).age).toBe(2);
    expect(scoreFindrisc(base({ age: 54 })).age).toBe(2);
    expect(scoreFindrisc(base({ age: 55 })).age).toBe(3);
    expect(scoreFindrisc(base({ age: 64 })).age).toBe(3);
    expect(scoreFindrisc(base({ age: 65 })).age).toBe(4);
  });

  it("BMI", () => {
    expect(scoreFindrisc(base({ bmi: 24.9 })).bmi).toBe(0);
    expect(scoreFindrisc(base({ bmi: 25 })).bmi).toBe(1);
    expect(scoreFindrisc(base({ bmi: 29.9 })).bmi).toBe(1);
    expect(scoreFindrisc(base({ bmi: 30 })).bmi).toBe(3);
  });

  it("腰围（男）", () => {
    expect(scoreFindrisc(base({ sex: "male", waistCm: 93 })).waist).toBe(0);
    expect(scoreFindrisc(base({ sex: "male", waistCm: 94 })).waist).toBe(3);
    expect(scoreFindrisc(base({ sex: "male", waistCm: 102 })).waist).toBe(3);
    expect(scoreFindrisc(base({ sex: "male", waistCm: 103 })).waist).toBe(4);
  });

  it("腰围（女）", () => {
    expect(scoreFindrisc(base({ sex: "female", waistCm: 79 })).waist).toBe(0);
    expect(scoreFindrisc(base({ sex: "female", waistCm: 80 })).waist).toBe(3);
    expect(scoreFindrisc(base({ sex: "female", waistCm: 88 })).waist).toBe(3);
    expect(scoreFindrisc(base({ sex: "female", waistCm: 89 })).waist).toBe(4);
  });

  it("体力活动", () => {
    expect(scoreFindrisc(base({ physicallyActive: true })).physicalActivity).toBe(0);
    expect(scoreFindrisc(base({ physicallyActive: false })).physicalActivity).toBe(2);
  });

  it("蔬果摄入", () => {
    expect(scoreFindrisc(base({ eatsVegetablesDaily: true })).diet).toBe(0);
    expect(scoreFindrisc(base({ eatsVegetablesDaily: false })).diet).toBe(1);
  });

  it("降压药", () => {
    expect(scoreFindrisc(base({ onAntihypertensive: false })).antihypertensive).toBe(0);
    expect(scoreFindrisc(base({ onAntihypertensive: true })).antihypertensive).toBe(2);
  });

  it("高血糖史", () => {
    expect(scoreFindrisc(base({ historyOfHighGlucose: false })).highGlucose).toBe(0);
    expect(scoreFindrisc(base({ historyOfHighGlucose: true })).highGlucose).toBe(5);
  });

  it("家族史（三级）", () => {
    expect(scoreFindrisc(base({ familyHistory: "none" })).familyHistory).toBe(0);
    expect(scoreFindrisc(base({ familyHistory: "second" })).familyHistory).toBe(3);
    expect(scoreFindrisc(base({ familyHistory: "first" })).familyHistory).toBe(5);
  });
});

describe("总分与分层边界", () => {
  it("全 0 分 = 极低风险", () => {
    const r = evaluateFindrisc(base());
    expect(r.score).toBe(0);
    expect(r.current.band).toBe("low");
  });

  it("分层边界：严格对齐 0–6 / 7–11 / 12–14 / 15–20 / 21–26", () => {
    expect(bandOf(0)).toBe("low");
    expect(bandOf(6)).toBe("low");
    expect(bandOf(7)).toBe("slightly-elevated");
    expect(bandOf(11)).toBe("slightly-elevated");
    expect(bandOf(12)).toBe("moderate");
    expect(bandOf(14)).toBe("moderate");
    expect(bandOf(15)).toBe("high");
    expect(bandOf(20)).toBe("high");
    expect(bandOf(21)).toBe("very-high");
    expect(bandOf(26)).toBe("very-high");
  });

  it("10 年风险值：1% / 4% / 17% / 33% / 50%，不区分性别", () => {
    expect(evaluateFindrisc(base()).current.tenYearRiskPercent).toBe(1);
    expect(evaluateFindrisc(base({ sex: "female" })).current.tenYearRiskPercent).toBe(1);
    // 16 分 → 高（15–20）→ 33%
    const r16 = evaluateFindrisc(
      base({
        age: 65,
        familyHistory: "first",
        historyOfHighGlucose: true,
        onAntihypertensive: true,
      }),
    );
    expect(r16.score).toBe(16);
    expect(r16.current.band).toBe("high");
    expect(r16.current.tenYearRiskPercent).toBe(33);
  });
});

describe("可回收风险（反事实）", () => {
  it("一个高危案例的可回收部分", () => {
    // age 58 = 3, bmi 31 = 3, waist 105 = 4, 不运动 = 2, 不吃蔬果 = 1,
    // 降压药 = 2, 高血糖 = 5, 一级亲属 = 5 → 总分 25
    const r = evaluateFindrisc(
      base({
        age: 58,
        bmi: 31,
        waistCm: 105,
        physicallyActive: false,
        eatsVegetablesDaily: false,
        onAntihypertensive: true,
        historyOfHighGlucose: true,
        familyHistory: "first",
      }),
    );

    expect(r.score).toBe(25);
    expect(r.current.band).toBe("very-high");

    // 可改变项：bmi 3 + waist 4 + physicalActivity 2 + diet 1 = 10
    expect(r.modifiableScore).toBe(10);
    expect(r.reclaimablePoints).toBe(10);
    // 达标后：25 - 10 = 15 → high（15–20）→ 33%
    expect(r.bestAchievableScore).toBe(15);
    expect(r.best.band).toBe("high");
    expect(r.best.tenYearRiskPercent).toBe(33);
  });

  it("无家族史但生活方式差的人，可回收项不应包含家族史", () => {
    const r = evaluateFindrisc(
      base({ bmi: 30, waistCm: 103, physicallyActive: false }),
    );
    // bmi 3 + waist 4 + activity 2 = 9，家族史 0 分不参与
    expect(r.modifiableScore).toBe(9);
    expect(r.bestAchievableScore).toBe(0);
    expect(r.best.band).toBe("low");
  });

  it("降压药条目不纳入可回收（是既有治疗状态，不是生活方式目标）", () => {
    const r = evaluateFindrisc(base({ onAntihypertensive: true }));
    expect(r.score).toBe(2);
    expect(r.modifiableScore).toBe(0); // 降压药 2 分不可回收
    expect(r.bestAchievableScore).toBe(2);
  });
});
