import { describe, expect, it } from "vitest";
import { guardDiseaseSubject, withLungPointer } from "./loop";

/**
 * 疾病主语守卫。
 * 真实事故：问「你们能算肺癌风险吗」，模型把 FINDRISC 的糖尿病结果
 * 说成「你的未来 10 年肺癌风险为 17%」——数字有出处，病名是编的。
 */
describe("疾病主语守卫", () => {
  const diabetesObs = ["FINDRISC 总分 16 分", "未来 10 年 2 型糖尿病风险 17%", "可回收 7 分"];

  it("把糖尿病数字说成肺癌 → 整段换掉", () => {
    const bad = "你的未来 10 年肺癌风险为 17%，可回收 7 分，达标后可降到 4%。";
    const fixed = guardDiseaseSubject(bad, diabetesObs);
    expect(fixed).not.toMatch(/肺癌风险为/);
    expect(fixed).toContain("PLCOm2012");
  });

  it("正常的糖尿病回答不受影响", () => {
    const good = "你的 2 型糖尿病风险是 17%，属于高危档，其中 7 分可回收。";
    expect(guardDiseaseSubject(good, diabetesObs)).toBe(good);
  });

  it("确实算了肺癌（观察里有 PLCO）时放行", () => {
    const ans = "按 PLCOm2012，你的 6 年肺癌风险是 3.6%。";
    expect(guardDiseaseSubject(ans, ["PLCOm2012 6 年风险 3.6%"])).toBe(ans);
  });

  it("没有百分比的科普回答不动", () => {
    const ans = "家族史会抬高血压和糖尿病风险，但具体数字要看你的体检。";
    expect(guardDiseaseSubject(ans, diabetesObs)).toBe(ans);
  });

  it("把心血管数字说成肺癌也要拦", () => {
    const cvdObs = ["China-PAR 10 年 ASCVD 风险 10.9%"];
    const bad = "你的肺癌风险约为 10.9%。";
    expect(guardDiseaseSubject(bad, cvdObs)).toContain("PLCOm2012");
  });
});

describe("肺癌问题的去处引导", () => {
  it("问肺癌但回答不提肺癌 → 补上 PLCOm2012 引导", () => {
    const out = withLungPointer("你们能算肺癌风险吗？", "总分 0–6 为低风险，约 1%。");
    expect(out).toContain("PLCOm2012");
    expect(out).toContain("肺癌风险」页");
  });

  it("回答已经提到肺癌 → 不重复补", () => {
    const ans = "肺癌要看 PLCOm2012，6 年风险 3.6%。";
    expect(withLungPointer("肺癌风险多少", ans)).toBe(ans);
  });

  it("问的不是肺癌 → 不动", () => {
    const ans = "你的糖尿病风险是 17%。";
    expect(withLungPointer("我的糖尿病风险", ans)).toBe(ans);
  });
});
