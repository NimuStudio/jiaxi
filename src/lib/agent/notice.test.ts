import { describe, expect, it } from "vitest";
import { withNoSourceNotice } from "./loop.ts";

describe("withNoSourceNotice", () => {
  it("事实类且没引用任何条目时补一句中性说明", () => {
    const out = withNoSourceNotice("大庆研究能降低多少风险", "你的风险是 4%。", []);
    expect(out).toContain("没有引用知识库条目");
    expect(out).toContain("依据是什么");
  });

  it("引用了条目时不追加", () => {
    const out = withNoSourceNotice("FINDRISC 满分是多少", "是 26 分。", ["kb-version"]);
    expect(out).toBe("是 26 分。");
  });

  it("个人问题不追加（避免答非所问）", () => {
    const out = withNoSourceNotice("我的风险是多少", "你的风险是 4%。", []);
    expect(out).toBe("你的风险是 4%。");
  });
});
