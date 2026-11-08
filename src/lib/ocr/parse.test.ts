import { describe, expect, it } from "vitest";
import { mapLabItems, parseOcrJson, toMmol, toNumber } from "./parse.ts";

describe("toNumber", () => {
  it("抠出普通数值", () => {
    expect(toNumber("6.8")).toBe(6.8);
    expect(toNumber("5.72 mmol/L")).toBe(5.72);
  });
  it("去掉箭头与全角比较符", () => {
    expect(toNumber("↑6.8")).toBe(6.8);
    expect(toNumber("＜3.40")).toBe(3.4);
  });
  it("没有数字时返回 null", () => {
    expect(toNumber("阴性")).toBeNull();
  });
});

describe("parseOcrJson", () => {
  it("能从代码块包裹的 JSON 里取数组", () => {
    const raw = "```json\n[{\"name\":\"总胆固醇\",\"value\":\"5.72\",\"unit\":\"mmol/L\",\"ref\":\"<5.20\"}]\n```";
    const items = parseOcrJson(raw);
    expect(items).toHaveLength(1);
    expect(items[0]?.value).toBe(5.72);
  });
  it("非法 JSON 返回空数组，不抛错", () => {
    expect(parseOcrJson("识别失败")).toEqual([]);
  });
});

describe("toMmol", () => {
  it("mg/dL 换算成 mmol/L", () => {
    expect(toMmol(200, "mg/dL")).toBeCloseTo(5.17, 1);
  });
  it("mmol/L 原样返回", () => {
    expect(toMmol(5.72, "mmol/L")).toBe(5.72);
  });
  it("不认识的单位不做猜测", () => {
    expect(toMmol(5.7, "g/L")).toBeNull();
  });
});

describe("mapLabItems", () => {
  it("映射总胆固醇与高密度脂蛋白", () => {
    const { fields } = mapLabItems([
      { name: "总胆固醇", value: 5.72, unit: "mmol/L", ref: "<5.20" },
      { name: "高密度脂蛋白", value: 1.02, unit: "mmol/L", ref: ">1.04" },
    ]);
    expect(fields.totalCholesterolMmol).toBe(5.72);
    expect(fields.hdlMmol).toBe(1.02);
  });
  it("血糖不会被当成「已诊断糖尿病」", () => {
    const { fields, unused } = mapLabItems([
      { name: "空腹血糖", value: 6.8, unit: "mmol/L", ref: "3.9-6.1" },
    ]);
    expect(fields).toEqual({});
    expect(unused).toHaveLength(1);
  });
  it("年龄与收缩压也能映射", () => {
    const { fields } = mapLabItems([
      { name: "年龄", value: 45, unit: "", ref: "" },
      { name: "收缩压", value: 145, unit: "mmHg", ref: "" },
    ]);
    expect(fields.age).toBe(45);
    expect(fields.sbp).toBe(145);
  });
});

describe("腰围映射（体检表常见项）", () => {
  it("腰围 cm 直接映射", () => {
    const r = mapLabItems([{ name: "腰围", value: 80, unit: "cm", ref: "-" } as never]);
    expect(r.fields.waistCm).toBe(80);
    expect(r.unused.length).toBe(0);
  });

  it("腹围也认", () => {
    const r = mapLabItems([{ name: "腹围", value: 92, unit: "cm", ref: "-" } as never]);
    expect(r.fields.waistCm).toBe(92);
  });

  it("英寸换算成厘米", () => {
    const r = mapLabItems([{ name: "腰围", value: 32, unit: "inch", ref: "-" } as never]);
    expect(r.fields.waistCm).toBeCloseTo(81.3, 1);
  });

  it("单位认不出就当未映射（不猜）", () => {
    const r = mapLabItems([{ name: "腰围", value: 80, unit: "furlong", ref: "-" } as never]);
    expect(r.fields.waistCm).toBeUndefined();
    expect(r.unused.length).toBe(1);
  });

  it("腰围不会污染其他字段", () => {
    const r = mapLabItems([
      { name: "腰围", value: 80, unit: "cm", ref: "-" } as never,
      { name: "收缩压", value: 132, unit: "mmHg", ref: "-" } as never,
    ]);
    expect(r.fields.waistCm).toBe(80);
    expect(r.fields.sbp).toBe(132);
  });
});
