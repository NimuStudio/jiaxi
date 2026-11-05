import { describe, expect, it } from "vitest";
import { attachCitationSources } from "./loop.ts";

describe("attachCitationSources", () => {
  it("给已检索到的条目补上真实出处", () => {
    const map = new Map([["0–20 分和 0–26 分是两个版本", "Lindström & Tuomilehto 2003"]]);
    const out = attachCitationSources("分数越高风险越高。依据：《0–20 分和 0–26 分是两个版本》", map);
    expect(out).toContain("（出处：Lindström & Tuomilehto 2003）");
  });

  it("知识库里没有的标题保持原样（由引用清洗负责删除）", () => {
    const out = attachCitationSources("依据：《中国2型糖尿病防治指南》", new Map());
    expect(out).toBe("依据：《中国2型糖尿病防治指南》");
  });

  it("没有依据时不改动文本", () => {
    const out = attachCitationSources("你的风险是 4%", new Map());
    expect(out).toBe("你的风险是 4%");
  });
});
