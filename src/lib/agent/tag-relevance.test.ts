import { describe, expect, it } from "vitest";
import { isTagRelevant } from "./loop.ts";

describe("isTagRelevant", () => {
  it("问题里出现条目标签时成立", () => {
    expect(isTagRelevant("FINDRISC 的满分是多少", ["概述", "量表", "FINDRISC"])).toBe(true);
    expect(isTagRelevant("腰围的阈值是多少", ["腰围", "腹型肥胖", "阈值"])).toBe(true);
  });

  it("与问题无关的条目不成立（防止给答案安上不相干的依据）", () => {
    expect(isTagRelevant("光合作用是什么", ["概述", "量表", "FINDRISC"])).toBe(false);
    expect(isTagRelevant("大庆研究能降低多少风险", ["高血压", "降压药"])).toBe(false);
  });

  it("英文标签大小写不敏感", () => {
    expect(isTagRelevant("chinapar 怎么分层", ["China-PAR", "心血管"])).toBe(true);
  });
});
