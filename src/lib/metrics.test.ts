import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DISEASES } from "./extract/lexicon.ts";
import { METRICS } from "./metrics.ts";

/**
 * 防"幻视"：页面上的对外数字必须与代码和评测产物一致。
 * 之前登录页写死「25 种疾病」「1.000 F1」，词表变成 26 种、F1 换过口径都没人发现。
 */
describe("对外数字与实际一致", () => {
  it("疾病种数 == 词表长度", () => {
    expect(METRICS.diseaseCount).toBe(DISEASES.length);
  });

  it("F1 文本与数值一致", () => {
    expect(METRICS.extractionF1Text).toBe(METRICS.extractionF1.toFixed(3));
  });

  it("百分数与取值范围合理", () => {
    expect(METRICS.localInferencePct).toBe(100);
    expect(METRICS.riskModelCount).toBe(3);
  });

  it("F1 与最近一份口语留出集产物一致（漂移即失败）", () => {
    const dir = join(process.cwd(), "docs", "eval-results");
    const files = readdirSync(dir)
      .filter((f) => f.includes("holdout") && f.endsWith(".json"))
      .map((f) => ({ f, mtime: Number(f.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/)?.[0]?.replace(/\D/g, "") ?? 0) }))
      .sort((a, b) => b.mtime - a.mtime);
    expect(files.length).toBeGreaterThan(0);
    const latest = JSON.parse(readFileSync(join(dir, files[0]!.f), "utf8")) as { f1: number; n: number };
    expect(latest.n).toBeGreaterThanOrEqual(30);
    expect(Math.abs(latest.f1 - METRICS.extractionF1)).toBeLessThanOrEqual(0.001);
  });
});
