import { describe, expect, it } from "vitest";
import { readLungFamilyHistory } from "./lungFamily";
import type { ExtractedPerson } from "@/lib/extract/client";

const person = (relation: string, codes: string[]): ExtractedPerson => ({
  relation,
  sex: "male",
  conditions: codes.map((code) => ({ code, onsetAge: null })),
});

describe("肺癌家族史判定", () => {
  it("父亲有肺癌 → 一级亲属阳性", () => {
    const r = readLungFamilyHistory([person("father", ["lung-cancer"])]);
    expect(r.firstDegree?.relation).toBe("father");
    expect(r.secondDegree).toBeNull();
  });

  it("子女有肺癌也算一级亲属", () => {
    const r = readLungFamilyHistory([person("daughter", ["lung-cancer"])]);
    expect(r.firstDegree?.relation).toBe("daughter");
  });

  it("爷爷有肺癌 → 只算二级，不自动勾选，但要给提示", () => {
    const r = readLungFamilyHistory([person("paternal-grandfather", ["lung-cancer"])]);
    expect(r.firstDegree).toBeNull();
    expect(r.secondDegree?.relation).toBe("paternal-grandfather");
  });

  it("一级与二级同时有 → 优先一级，二级提示让位", () => {
    const r = readLungFamilyHistory([
      person("paternal-grandfather", ["lung-cancer"]),
      person("mother", ["lung-cancer"]),
    ]);
    expect(r.firstDegree?.relation).toBe("mother");
    expect(r.secondDegree).toBeNull();
  });

  it("兼容早期中文病名", () => {
    const r = readLungFamilyHistory([person("father", ["肺癌"])]);
    expect(r.firstDegree?.relation).toBe("father");
  });

  it("其他病不算肺癌", () => {
    const r = readLungFamilyHistory([
      person("father", ["myocardial-infarction"]),
      person("mother", ["type2-diabetes"]),
      person("self", ["hypertension"]),
    ]);
    expect(r.firstDegree).toBeNull();
    expect(r.secondDegree).toBeNull();
  });

  it("本人有肺癌不算家族史", () => {
    const r = readLungFamilyHistory([person("self", ["lung-cancer"])]);
    expect(r.firstDegree).toBeNull();
    expect(r.secondDegree).toBeNull();
  });
});
