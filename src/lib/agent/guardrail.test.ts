import { describe, expect, it } from "vitest";
import { withMedicalGuardrail } from "./loop.ts";

describe("withMedicalGuardrail", () => {
  it("药物类问题补上一句就医提示", () => {
    const out = withMedicalGuardrail("吃二甲双胍能把风险降到多少？", "你的风险是 4%。");
    expect(out).toContain("医生");
    expect(out).toContain("不提供用药建议");
  });

  it("已经提到医生时不重复追加", () => {
    const a = "请咨询医生后再决定用药。";
    expect(withMedicalGuardrail("吃什么药", a)).toBe(a);
  });

  it("无关问题不加护栏", () => {
    const a = "你的风险是 4%。";
    expect(withMedicalGuardrail("我的风险是多少", a)).toBe(a);
  });
});
