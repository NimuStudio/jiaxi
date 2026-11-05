import { describe, expect, it } from "vitest";
import { dropNegatedOrUncertain } from "./client";
import type { ExtractedPerson } from "./client";

const person = (code: string): ExtractedPerson => ({
  relation: "paternal-grandfather",
  sex: "male",
  conditions: [{ code, onsetAge: null }],
});

describe("否定与不确定表述的守卫", () => {
  it("「没有糖尿病」不产出患病节点", () => {
    expect(dropNegatedOrUncertain("我爷爷没有糖尿病", person("type2-diabetes"))).toBeNull();
  });

  it("没有具体病名的 other 占位节点，在否定句里也丢弃", () => {
    expect(dropNegatedOrUncertain("我爷爷没有糖尿病", person("other"))).toBeNull();
  });

  it("不确定表述不当确诊", () => {
    expect(dropNegatedOrUncertain("我奶奶好像有糖尿病", person("type2-diabetes"))).toBeNull();
  });

  it("否定之后有转折时，后半句的病要保留", () => {
    const kept = dropNegatedOrUncertain("我爷爷没有糖尿病，但有高血压", person("hypertension"));
    expect(kept?.conditions.map((c) => c.code)).toEqual(["hypertension"]);
  });

  it("正常陈述不被误杀", () => {
    const kept = dropNegatedOrUncertain("我爸五十岁放了支架", person("coronary-heart-disease"));
    expect(kept?.conditions).toHaveLength(1);
  });
});
