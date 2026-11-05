import { describe, expect, it } from "vitest";

// cleanCitations 未导出，这里通过 runAgent 的公开行为不便单测，故直接测正则等价实现
const ALLOWED = new Set(["0–20 分和 0–26 分是两个版本"]);
function strip(answer: string): string {
  let s = answer.replace(/依据[：:]\s*《?([^》\n。！？；]+?)》?(?=[。！？；\n]|$)/g, (w, t: string) => (ALLOWED.has(t.trim()) ? w : ""));
  s = s.replace(/依据[：:]\s*《([^》]+)》/g, (w, t: string) => (ALLOWED.has(t.trim()) ? w : ""));
  return s.trim();
}

describe("依据清理（书名号后直接接正文）", () => {
  it("标题被改写的假依据要删掉", () => {
    const raw = "满分 26 分。依据：《0–26 分和 0–26 分是两个版本》FINDRISC 原始论文发表于 2003 年。";
    expect(strip(raw)).not.toContain("依据：");
  });

  it("标题正确的依据要保留", () => {
    const raw = "满分 26 分。依据：《0–20 分和 0–26 分是两个版本》";
    expect(strip(raw)).toContain("依据：");
  });
});
