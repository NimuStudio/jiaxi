import { describe, expect, it } from "vitest";
import { expandSharedCondition } from "./client.ts";

const mi = { code: "myocardial-infarction", onsetAge: null };

describe("expandSharedCondition", () => {
  it("两个主语共享一个病时补上第二个", () => {
    const out = expandSharedCondition("我爸和我叔都心梗。", [
      { relation: "father", sex: "male", conditions: [{ ...mi }] },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.relation).sort()).toEqual(["father", "paternal-uncle"]);
  });

  it("只有一个主语时不扩展", () => {
    const out = expandSharedCondition("我爸心梗。", [
      { relation: "father", sex: "male", conditions: [{ ...mi }] },
    ]);
    expect(out).toHaveLength(1);
  });

  it("没有并列词时不扩展（避免误挂）", () => {
    const out = expandSharedCondition("我爸心梗，我叔也一样", [
      { relation: "father", sex: "male", conditions: [{ ...mi }] },
    ]);
    expect(out).toHaveLength(1);
  });

  it("已有两人时不重复扩展", () => {
    const people = [
      { relation: "father", sex: "male" as const, conditions: [{ ...mi }] },
      { relation: "mother", sex: "female" as const, conditions: [{ ...mi }] },
    ];
    expect(expandSharedCondition("我爸和我妈都心梗", people)).toHaveLength(2);
  });
});
