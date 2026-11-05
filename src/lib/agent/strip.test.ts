import { describe, expect, it } from "vitest";
import { stripInternalHints } from "./loop.ts";

describe("stripInternalHints", () => {
  it("删掉给模型看的内部指令", () => {
    const raw = "FINDRISC 满分 26 分。（已检索到内容，请直接据此作答，不要换措辞重复检索。）";
    expect(stripInternalHints(raw)).toBe("FINDRISC 满分 26 分。");
  });

  it("删掉工具计次的提示", () => {
    const raw = "答案在这里。（search_knowledge 本轮已调用 2 次，结果不会更多了。请换一个工具，或直接 final_answer 回答。）";
    expect(stripInternalHints(raw)).toBe("答案在这里。");
  });

  it("正常文本不受影响", () => {
    const raw = "你的风险是 4%，可回收 7 分。";
    expect(stripInternalHints(raw)).toBe(raw);
  });
});
