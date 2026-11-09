import { describe, expect, it } from "vitest";
import { structuralDecide, structuralFeatures } from "./structural.ts";
import type { ExtractedPerson } from "../extract/client.ts";

function p(relation: string, sex: ExtractedPerson["sex"], age: number | null = null): ExtractedPerson {
  return {
    relation,
    sex,
    conditions: age === null ? [] : [{ code: "myocardial-infarction", onsetAge: age }],
  };
}

describe("structuralFeatures", () => {
  it("12 维，且顺序与 python 训练脚本一致", () => {
    const f = structuralFeatures([p("father", "male", 52)]);
    expect(f).toHaveLength(12);
    expect(f[0]).toBeCloseTo(Math.log(2), 6); // ln(1+1)
    expect(f[2]).toBe(0); // 父辈不是祖辈
    expect(f[3]).toBeCloseTo(1 / 3, 6); // 1 个父辈患病
  });

  it("男传男特征：父亲与本人男性均患病才为 1", () => {
    expect(structuralFeatures([p("father", "male", 52), p("self", "male", 40)])[9]).toBe(1);
    expect(structuralFeatures([p("father", "male", 52), p("self", "female", 40)])[9]).toBe(0);
  });

  it("没有患病亲属时给出无病例标记", () => {
    expect(structuralFeatures([p("father", "male")])[10]).toBe(1);
  });
});

describe("structuralDecide", () => {
  it("三代男性连续发病 -> 判显性", () => {
    const persons = [
      p("paternal-grandfather", "male", 45),
      p("father", "male", 52),
      p("paternal-uncle", "male", 48),
      p("self", "male", 40),
    ];
    const r = structuralDecide(persons);
    expect(r.mode).toBe("autosomal-dominant");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  it("母系三代连续发病 -> 判线粒体（大模型在这例上判错）", () => {
    const persons = [
      p("maternal-grandmother", "female", 40),
      p("mother", "female", 45),
      p("self", "male", 22),
      p("father", "male", null),
    ];
    expect(structuralDecide(persons).mode).toBe("mitochondrial");
  });

  it("信息稀疏 -> 判证据不足", () => {
    const r = structuralDecide([p("father", "male", 52), p("mother", "female", null)]);
    expect(r.mode).toBe("insufficient");
  });

  it("概率和为 1", () => {
    const r = structuralDecide([p("father", "male", 52)]);
    const sum = Object.values(r.probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
