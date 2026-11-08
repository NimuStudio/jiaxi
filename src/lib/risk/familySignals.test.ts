import { describe, expect, it } from "vitest";
import { familySignals } from "./familySignals.ts";
import type { ExtractedPerson } from "../extract/client";

const p = (relation: string, code: string): ExtractedPerson => ({
  relation,
  sex: relation.includes("mother") || relation.includes("grandmother") ? "female" : "male",
  conditions: [{ code, onsetAge: null }],
});

describe("familySignals", () => {
  it("同一疾病 ≥2 位一级亲属时给出成簇信号", () => {
    const s = familySignals([p("father", "type2-diabetes"), p("mother", "type2-diabetes")]);
    expect(s.some((x) => x.id === "cluster-first-type2-diabetes")).toBe(true);
    expect(s.find((x) => x.id === "cluster-first-type2-diabetes")?.level).toBe("attention");
  });

  it("父系与母系同病时给出双侧信号", () => {
    const s = familySignals([
      p("paternal-grandfather", "myocardial-infarction"),
      p("maternal-grandmother", "myocardial-infarction"),
    ]);
    expect(s.some((x) => x.id === "both-sides-myocardial-infarction")).toBe(true);
  });

  it("单侧跨代出现时给出多代信号", () => {
    const s = familySignals([
      p("paternal-grandfather", "hypertension"),
      p("father", "hypertension"),
    ]);
    expect(s.some((x) => x.id === "multi-gen-hypertension")).toBe(true);
  });

  it("一级亲属肿瘤单独提示，且明确说做概率推算", () => {
    const s = familySignals([p("father", "lung-cancer")]);
    const hit = s.find((x) => x.id === "first-degree-cancer");
    expect(hit?.title).toContain("恶性肿瘤");
    expect(hit?.body).toContain("PLCOm2012");
    expect(hit?.body).toContain("其他癌种目前不做概率推算");
  });

  it("没有亲属时不产生信号", () => {
    expect(familySignals([])).toEqual([]);
  });
});
