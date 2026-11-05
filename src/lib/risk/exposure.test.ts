import { describe, expect, it } from "vitest";
import { exposureHints, hasFirstDegreeLung } from "./exposure.ts";
import type { ExtractedPerson } from "@/lib/extract/client";

const fatherLung: ExtractedPerson[] = [
  { relation: "father", sex: "male", conditions: [{ code: "lung-cancer", onsetAge: 60 }] },
];

describe("hasFirstDegreeLung", () => {
  it("一级亲属肺癌成立", () => {
    expect(hasFirstDegreeLung(fatherLung)).toBe(true);
  });
  it("二级亲属不算", () => {
    const persons: ExtractedPerson[] = [
      { relation: "paternal-grandfather", sex: "male", conditions: [{ code: "lung-cancer", onsetAge: 70 }] },
    ];
    expect(hasFirstDegreeLung(persons)).toBe(false);
  });
});

describe("exposureHints", () => {
  it("家族肺癌给出可引用的相对风险（ILCCO 1.51）", () => {
    const hints = exposureHints(fatherLung, { smoker: false, drinker: false, lungDisease: false });
    const hit = hints.find((h) => h.id === "family-lung-history");
    expect(hit?.level).toBe("attention");
    expect(hit?.body).toContain("1.51");
    expect(hit?.body).toContain("1.39–1.63");
    expect(hit?.body).toContain("不是你个人的绝对概率");
  });

  it("同胞患病时补充 1.82 倍", () => {
    const persons: ExtractedPerson[] = [
      { relation: "sister", sex: "female", conditions: [{ code: "lung-cancer", onsetAge: 55 }] },
    ];
    const hit = exposureHints(persons, { smoker: false, drinker: false, lungDisease: false }).find(
      (h) => h.id === "family-lung-history",
    );
    expect(hit?.title).toContain("同胞");
    expect(hit?.body).toContain("1.82");
  });

  it("家族肺癌 + 吸烟给出组合提示", () => {
    const hints = exposureHints(fatherLung, { smoker: true, drinker: false, lungDisease: false });
    const hit = hints.find((h) => h.id === "lung-family-smoker");
    expect(hit?.level).toBe("attention");
    expect(hit?.body).toContain("都不换算成个人概率");
  });

  it("吸烟单独出现时说明它已进方程", () => {
    const hints = exposureHints([], { smoker: true, drinker: false, lungDisease: false });
    expect(hints.some((h) => h.id === "smoker-chinapar")).toBe(true);
  });

  it("饮酒要明确说明不改变分数", () => {
    const hints = exposureHints([], { smoker: false, drinker: true, lungDisease: false });
    const hit = hints.find((h) => h.id === "drinker-not-in-model");
    expect(hit?.body).toContain("不会改变上面的分数");
  });

  it("既往肺部疾病给出相对风险数字，并说明不是个人概率", () => {
    const hints = exposureHints([], { smoker: false, drinker: false, lungDisease: true });
    const hit = hints.find((h) => h.id === "lung-disease-rr");
    expect(hit?.body).toContain("1.80");
    expect(hit?.body).toContain("95% CI 1.60–2.11");
    expect(hit?.body).toContain("不是你的个人概率");
  });

  it("都不存在时不产生提示", () => {
    expect(exposureHints([], { smoker: false, drinker: false, lungDisease: false })).toHaveLength(0);
  });
});
