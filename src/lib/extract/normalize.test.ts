/**
 * 归一世（normalizeSegment）的回归测试。
 *
 * 背景：模型对「放了支架」「做了心脏搭桥手术」这类口语动词说法会输出 other，
 * 即使把这些说法加进 GBNF 可选字面量也没有改善（实测）。所以改在送模型前归一成规范病名。
 */
import { describe, expect, it } from "vitest";
import { normalizeSegment } from "./client.ts";

describe("normalizeSegment", () => {
  it("把「放了支架」归一成冠心病", () => {
    const out = normalizeSegment("我爸五十岁放了支架");
    expect(out).toContain("冠心病");
    expect(out).not.toContain("支架");
  });

  it("把「心脏搭桥手术」归一成冠心病", () => {
    const out = normalizeSegment("我爸做了心脏搭桥手术");
    expect(out).toContain("冠心病");
    expect(out).not.toContain("搭桥");
  });

  it("长别名优先，不残留半句", () => {
    const out = normalizeSegment("我爸放了心脏支架");
    expect(out).toContain("冠心病");
    expect(out).not.toContain("支架");
  });

  it("已经是规范病名的句子保持不变", () => {
    expect(normalizeSegment("我妈有糖尿病")).toBe("我妈有糖尿病");
  });

  it("不影响亲属称谓与年龄", () => {
    const out = normalizeSegment("我外婆六十岁时放了支架");
    expect(out).toContain("外婆");
    expect(out).toContain("六十");
  });
});
