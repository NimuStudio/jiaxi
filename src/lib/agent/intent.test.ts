import { describe, expect, it } from "vitest";
import { isFactualQuestion } from "./loop.ts";

describe("isFactualQuestion", () => {
  it("问知识库内容时成立", () => {
    expect(isFactualQuestion("FINDRISC 的满分是多少？")).toBe(true);
    expect(isFactualQuestion("0 到 20 分和 0 到 26 分有什么区别？")).toBe(true);
    expect(isFactualQuestion("腰围的阈值是多少")).toBe(true);
  });

  it("问自己的数据时不成立（不能抢走 compute_risk）", () => {
    expect(isFactualQuestion("我的糖尿病风险是多少？")).toBe(false);
    expect(isFactualQuestion("我还剩多少分是可以拿回来的？")).toBe(false);
    expect(isFactualQuestion("我需要做什么才能降低风险")).toBe(false);
  });
});
