import { describe, it, expect } from "vitest";
import {
  firstDegreeRelatives,
  secondDegreeRelatives,
  affectedCount,
  earliestOnsetAge,
  summarizeFamilyHistory,
} from "./pedigree";
import type { FamilyTree, Person } from "./types";

function person(
  id: string,
  relation: Person["relation"],
  extra: Partial<Person> = {},
): Person {
  return {
    id,
    sex: "unknown",
    deceased: "unknown",
    relation,
    conditions: [],
    ...extra,
  };
}

function buildTree(): FamilyTree {
  const father = person("father", "father", {
    sex: "male",
    conditions: [
      {
        code: "myocardial-infarction",
        rawText: "我爸 52 岁放支架",
        onsetAge: { value: 52, certainty: "exact" },
        source: "第 2 轮",
        confidence: 0.9,
      },
    ],
  });

  const mother = person("mother", "mother", { sex: "female" });

  const brother = person("brother", "brother", { sex: "male" });

  const paternalGrandfather = person("pgf", "paternal-grandfather", {
    sex: "male",
    conditions: [
      {
        code: "type2-diabetes",
        rawText: "爷爷有糖尿病",
        source: "第 5 轮",
        confidence: 0.8,
      },
    ],
  });

  const maternalUncle = person("maternal-uncle", "maternal-uncle", {
    sex: "male",
    conditions: [
      {
        code: "type2-diabetes",
        rawText: "舅舅 45 岁查出来的糖尿病",
        onsetAge: { value: 45, certainty: "approx" },
        source: "第 6 轮",
        confidence: 0.7,
      },
    ],
  });

  const spouse = person("spouse", "spouse", { sex: "female" });

  return {
    probandId: "self",
    persons: {
      self: person("self", "self"),
      father,
      mother,
      brother,
      pgf: paternalGrandfather,
      "maternal-uncle": maternalUncle,
      spouse,
    },
  };
}

describe("亲缘等级查询", () => {
  it("一级亲属：父、母、兄", () => {
    const tree = buildTree();
    const ids = firstDegreeRelatives(tree).map((p) => p.id).sort();
    expect(ids).toEqual(["brother", "father", "mother"]);
  });

  it("二级亲属：祖父母、叔姑舅姨", () => {
    const tree = buildTree();
    const ids = secondDegreeRelatives(tree).map((p) => p.id).sort();
    expect(ids).toEqual(["maternal-uncle", "pgf"]);
  });

  it("本人和配偶不算血缘亲属", () => {
    const tree = buildTree();
    const all = Object.values(tree.persons).map((p) => p.id);
    const relatives = [...firstDegreeRelatives(tree), ...secondDegreeRelatives(tree)].map(
      (p) => p.id,
    );
    expect(relatives).not.toContain("self");
    expect(relatives).not.toContain("spouse");
  });
});

describe("家族史三要素（谁 / 几个 / 几岁）", () => {
  it("患病人数统计", () => {
    const tree = buildTree();
    expect(affectedCount(tree, "type2-diabetes", 2)).toBe(2); // 爷爷 + 舅舅
    expect(affectedCount(tree, "type2-diabetes", 1)).toBe(0);
    expect(affectedCount(tree, "myocardial-infarction", 1)).toBe(1); // 父亲
  });

  it("最早发病年龄（含约数）", () => {
    const tree = buildTree();
    const onset = earliestOnsetAge(tree, "type2-diabetes", 2);
    expect(onset).toEqual({ value: 45, certainty: "approx" });
  });

  it("没有发病年龄记录时返回 null，不猜", () => {
    const tree = buildTree();
    // 爷爷有糖尿病但没填年龄，一级亲属无糖尿病
    expect(earliestOnsetAge(tree, "type2-diabetes", 1)).toBeNull();
  });

  it("汇总：缺一级亲属发病年龄也能正确报人数", () => {
    const tree = buildTree();
    const summary = summarizeFamilyHistory(tree, "type2-diabetes");
    expect(summary.hasHistory).toBe(true);
    expect(summary.firstDegreeCount).toBe(0);
    expect(summary.secondDegreeCount).toBe(2);
    expect(summary.earliestFirstDegreeOnset).toBeNull();
  });

  it("空家系树", () => {
    const tree: FamilyTree = { probandId: "self", persons: {} };
    expect(firstDegreeRelatives(tree)).toEqual([]);
    expect(summarizeFamilyHistory(tree, "type2-diabetes").hasHistory).toBe(false);
  });
});
