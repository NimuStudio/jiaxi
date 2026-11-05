import type { ExtractedPerson } from "@/lib/extract/client";
import { DISEASE_LABEL } from "../pedigree/viz";
import type { RelationType } from "../pedigree/types";

/**
 * 家系结构信号（纯结构事实，不需要任何外部系数）。
 *
 * 老师提的「按前几代的情况分析」，能落地又不编数字的部分就在这里：
 * 同一疾病在几位亲属中出现、父系与母系是否都出现、一级亲属里是否成簇。
 * 这些都是从家系结构直接数出来的，不依赖任何未经核实的效应量。
 *
 * 刻意不做：不给概率、不定义「早发」的年龄阈值（不同指南阈值不同，没核实就不写）。
 */

export type SignalLevel = "attention" | "info";

export interface FamilySignal {
  id: string;
  level: SignalLevel;
  title: string;
  body: string;
}

const FIRST_DEGREE: RelationType[] = [
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
];

/** 父系 / 母系：用于判断「两侧都出现」 */
function sideOf(relation: string): "paternal" | "maternal" | "other" {
  if (relation.startsWith("paternal-")) return "paternal";
  if (relation.startsWith("maternal-")) return "maternal";
  return "other";
}

export function familySignals(persons: ExtractedPerson[]): FamilySignal[] {
  // 病种 → 患病的亲属
  const byDisease = new Map<string, ExtractedPerson[]>();
  for (const p of persons) {
    for (const c of p.conditions ?? []) {
      const list = byDisease.get(c.code) ?? [];
      list.push(p);
      byDisease.set(c.code, list);
    }
  }

  const signals: FamilySignal[] = [];

  for (const [code, list] of byDisease) {
    const label = DISEASE_LABEL[code as keyof typeof DISEASE_LABEL] ?? code;
    const first = list.filter((p) => FIRST_DEGREE.includes(p.relation as RelationType));
    const paternal = list.some((p) => sideOf(p.relation) === "paternal");
    const maternal = list.some((p) => sideOf(p.relation) === "maternal");

    // ① 一级亲属成簇：同一疾病 ≥2 位一级亲属
    if (first.length >= 2) {
      signals.push({
        id: `cluster-first-${code}`,
        level: "attention",
        title: `${label}：${first.length} 位一级亲属都有`,
        body:
          "同一疾病在多位一级亲属中出现，通常被认为比只出现一次更值得关注。" +
          "这是家系结构的事实汇总，不是概率估计；建议把这张家系图带给医生看。",
      });
    }

    // ② 父系与母系都出现
    if (paternal && maternal) {
      signals.push({
        id: `both-sides-${code}`,
        level: "attention",
        title: `${label}：父系与母系两侧都出现过`,
        body:
          "两侧家族都出现同一疾病，值得和医生说明。" +
          "同样只是结构事实，本项目不据此给出任何概率。",
      });
    }

    // ③ 跨多代出现（≥2 个代际层级：祖辈 + 父辈/本人）
    const generations = new Set(
      list.map((p) => {
        const r = p.relation;
        if (r.includes("grand")) return "祖辈";
        // 子女不能算进「父辈」：祖父 + 儿子同病不是跨代聚集，是两端各一例
        if (r === "son" || r === "daughter") return "子辈";
        if (FIRST_DEGREE.includes(r as RelationType)) return "父辈/同辈";
        return "旁系";
      }),
    );
    // 跨代：祖辈与父辈都出现；若两侧都有，上面已经用更强的「双侧」信号覆盖，这里不重复
    if (generations.has("祖辈") && generations.has("父辈/同辈") && !(paternal && maternal)) {
      signals.push({
        id: `multi-gen-${code}`,
        level: "info",
        title: `${label}：在祖辈与父辈都出现`,
        body: "跨代出现同一种疾病，写进家系图里比只记在脑子里更容易被医生用上。",
      });
    }
  }

  // ④ 一级亲属有恶性肿瘤（任何癌种）
  const firstCancers = persons.filter(
    (p) =>
      FIRST_DEGREE.includes(p.relation as RelationType) &&
      (p.conditions ?? []).some((c) => c.code.includes("cancer")),
  );
  if (firstCancers.length > 0) {
    signals.push({
      id: "first-degree-cancer",
      level: "info",
      title: `一级亲属中有 ${firstCancers.length} 位患恶性肿瘤`,
      body:
        "这类信息在门诊问诊时经常被漏掉。我们不做癌症风险的概率推算——" +
        "筛查起始年龄与方案应以医生的判断和现行指南为准。",
    });
  }

  return signals;
}
