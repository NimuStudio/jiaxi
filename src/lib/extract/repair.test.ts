import { describe, expect, it } from "vitest";
import {
  diseaseCodesInText,
  expandContinuation,
  isContinuation,
  relationsInText,
  repairOtherCodes,
  repairRelations,
} from "./repair.ts";
import type { ExtractedPerson } from "./client.ts";

function p(relation: string, code: string | null, age: number | null = null): ExtractedPerson {
  return {
    relation,
    sex: "unknown",
    conditions: code ? [{ code, onsetAge: age }] : [],
  };
}

describe("relationsInText", () => {
  it("按出现顺序识别称谓", () => {
    expect(relationsInText("我爸和我哥都有高血压")).toEqual(["father", "brother"]);
  });
  it("母系称谓不误判成父系", () => {
    expect(relationsInText("舅舅和姨妈都高血压")).toEqual(["maternal-uncle", "maternal-aunt"]);
  });
});

describe("repairRelations", () => {
  it("把「我哥」被误判的 paternal-uncle 纠回 brother", () => {
    const out = repairRelations("我爸和我哥都有高血压", [
      p("father", "hypertension"),
      p("paternal-uncle", "hypertension"),
    ]);
    expect(out.map((x) => x.relation)).toEqual(["father", "brother"]);
  });

  it("「爸」被抽成 paternal-uncle 时纠回 father", () => {
    const out = repairRelations("我爸高血压，对，就是高血压，好多年了。", [
      p("paternal-uncle", "hypertension"),
    ]);
    expect(out[0]?.relation).toBe("father");
  });

  it("文中没有称谓时不动模型结果", () => {
    const out = repairRelations("高血压好多年了", [p("unknown", "hypertension")]);
    expect(out[0]?.relation).toBe("unknown");
  });

  it("模型本来就对的时候不重复分配", () => {
    const out = repairRelations("爷爷糖尿病，爸爸高血压", [
      p("paternal-grandfather", "type2-diabetes"),
      p("father", "hypertension"),
    ]);
    expect(out.map((x) => x.relation)).toEqual(["paternal-grandfather", "father"]);
  });
});

describe("diseaseCodesInText / repairOtherCodes", () => {
  it("房颤、慢阻肺、老年痴呆都能命中词表", () => {
    expect(diseaseCodesInText("爷爷房颤")).toContain("atrial-fibrillation");
    expect(diseaseCodesInText("我爸有慢阻肺")).toContain("copd");
    expect(diseaseCodesInText("外公是老年痴呆")).toContain("dementia");
  });

  it("other 换回真编码", () => {
    const out = repairOtherCodes("外公是老年痴呆", [p("maternal-grandfather", "other")]);
    expect(out[0]?.conditions[0]?.code).toBe("dementia");
  });

  it("原文没有病名的 other 直接丢掉（「一直在吃药」不是病）", () => {
    const out = repairOtherCodes("我妈一直在吃药。", [p("mother", "other")]);
    expect(out).toHaveLength(0);
  });

  it("「血压高」是高血压的口语说法，other 要换成 hypertension 而不是丢掉", () => {
    const out = repairOtherCodes("我妈血压高，一直在吃药。", [p("mother", "other")]);
    expect(out[0]?.conditions[0]?.code).toBe("hypertension");
  });

  it("非 other 的编码一律不动", () => {
    const out = repairOtherCodes("爷爷房颤", [p("paternal-grandfather", "atrial-fibrillation")]);
    expect(out[0]?.conditions[0]?.code).toBe("atrial-fibrillation");
  });
});

describe("续句继承", () => {
  it("识别续句", () => {
    expect(isContinuation("我哥也是")).toBe(true);
    expect(isContinuation("我妈高血压")).toBe(false); // 自己带病名，不算续句
  });

  it("补病名后成为完整句", () => {
    expect(expandContinuation("我哥也是", ["高血压"])).toBe("我哥也是高血压。");
  });

  it("没有可继承病名时原样返回", () => {
    expect(expandContinuation("我哥也是", [])).toBe("我哥也是");
  });
});
