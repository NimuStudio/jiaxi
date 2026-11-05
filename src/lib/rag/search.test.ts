import { describe, expect, it } from "vitest";
import kbData from "../../../data/kb/findrisc-kb.json" with { type: "json" };
import { searchKnowledge } from "./search.ts";

const KB = kbData as any[];

describe("searchKnowledge 排序", () => {
  it("问 FINDRISC 满分时，不应把讲「可回收」的条目排在前面", () => {
    const hits = searchKnowledge("FINDRISC 的满分是多少", KB, 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.id).not.toBe("kb-reclaimable");
  });

  it("问风险分档时应命中分档条目", () => {
    const hits = searchKnowledge("分数对应什么风险档", KB, 3);
    expect(hits.some((h) => h.id === "kb-bands" || h.id === "kb-ascvd-band")).toBe(true);
  });

  it("完全无关的问题返回空（宁可不答）", () => {
    expect(searchKnowledge("今天天气怎么样", KB, 3)).toHaveLength(0);
  });
});
