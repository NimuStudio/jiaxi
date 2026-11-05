import { describe, expect, it } from "vitest";
import { expandSharedCondition } from "./client";
import type { ExtractedPerson } from "./client";

const p = (relation: string, code: string, onsetAge: number | null = null): ExtractedPerson => ({
  relation,
  sex: "male",
  conditions: [{ code, onsetAge }],
});

describe("expandSharedCondition", () => {
  it("并列句里各人各病时不做任何扩展（「、」不是共享信号）", () => {
    const persons = [p("paternal-grandfather", "hypertension"), p("paternal-grandmother", "type2-diabetes")];
    const out = expandSharedCondition("我爷爷高血压、我奶奶糖尿病", persons);
    expect(out).toHaveLength(2);
    expect(out[0]?.conditions.map((c) => c.code)).toEqual(["hypertension"]);
    expect(out[1]?.conditions.map((c) => c.code)).toEqual(["type2-diabetes"]);
  });

  it("模型只给一人且句中是共享谓语时，才把病复制给另一位亲属", () => {
    const out = expandSharedCondition("我爷爷和我奶奶都有糖尿病", [p("paternal-grandfather", "type2-diabetes", 70)]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    // 病名共享，但发病年龄不能跟着复制（那是编造）
    expect(out[1]?.conditions[0]?.onsetAge).toBeNull();
  });
});
