/**
 * 年龄接地与词表兜底的回归测试。
 *
 * 两条都是「模型输出必须能被原文支撑」的具体落实：
 *  - 年龄：原文没有的数字一律置空（实测模型会凭空给 50）；
 *  - 兜底：病名被校验丢空时，用词表在原文里找回最长命中。
 */
import { describe, expect, it } from "vitest";
import { agesInText, groundAge, rescueCondition } from "./client.ts";

describe("agesInText", () => {
  it("识别中文数字", () => {
    expect(agesInText("我爸五十岁放了支架")).toContain(50);
    expect(agesInText("我外婆六十岁时")).toContain(60);
    expect(agesInText("三十五岁确诊")).toContain(35);
  });
  it("识别阿拉伯数字与十几", () => {
    expect(agesInText("我爸 52 岁")).toContain(52);
    expect(agesInText("十几岁就有")).toContain(10);
  });
  it("没有数字时为空", () => {
    expect(agesInText("我大伯胃癌，做完手术了。")).toEqual([]);
  });
});

describe("groundAge", () => {
  it("原文有该年龄则保留", () => {
    expect(groundAge("我爸五十岁放了支架", 50)).toBe(50);
  });
  it("原文没有的年龄一律置空（防编造）", () => {
    expect(groundAge("我大伯胃癌，做完手术了。", 50)).toBeNull();
  });
  it("本来就是 null 时保持 null", () => {
    expect(groundAge("我爸心梗", null)).toBeNull();
  });
});

describe("rescueCondition", () => {
  it("泛称癌症被丢弃后能按原文救回具体病种", () => {
    expect(rescueCondition("我爷爷肝癌走的。")?.code).toBe("liver-cancer");
  });
  it("原文没有疾病词时不救回", () => {
    expect(rescueCondition("我妈那边查过没事")).toBeNull();
  });
});
