import { describe, expect, it } from "vitest";
import { exposureHints } from "./exposure";
import type { ExtractedPerson } from "../extract/client";

const fatherAsthma: ExtractedPerson[] = [
  { relation: "father", sex: "male", conditions: [{ code: "asthma", onsetAge: null }] },
];

describe("家族史的适用范围", () => {
  it("一级亲属只有哮喘时，不得引用「一级亲属患肺癌」的 1.51 倍", () => {
    const hints = exposureHints(fatherAsthma, { smoker: false, drinker: false, lungDisease: false });
    expect(hints.some((h) => h.id === "family-lung-history")).toBe(false);
    expect(hints.map((h) => h.body).join("")).not.toContain("1.51");
  });
});
