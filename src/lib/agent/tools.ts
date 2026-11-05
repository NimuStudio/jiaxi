/**
 * Agent 的工具层
 *
 * 这三个工具不是「为了显得像 Agent」而包装的，它们分别对应系统里已经存在的
 * 三段真实能力：家族史汇总、风险量化、指南检索。Agent 的价值在于**它自己决定**
 * 先查什么、要不要再算、什么时候能回答——而不是按固定顺序跑一遍。
 *
 * 设计上有一条硬边界：
 *   模型只负责「决策」（调哪个工具、要不要收尾）；
 *   关键数字由工具返回**结构化事实**，界面直接拿这些事实渲染，不经过模型复述。
 *
 * 原因是实测的：1.7B 复述时会把「可回收 7 分」说成「可回收率 4%」，
 * 甚至编出「降低约 50% 风险」。健康类产品里这种错误不能靠提示词兜。
 */

import { summarizeFamilyHistory } from "../pedigree/pedigree.ts";
import type { FamilyTree, Person, RelationType } from "../pedigree/types.ts";
import { evaluateFindrisc, MODIFIABLE_KEYS, type ScoreKey } from "../risk/findrisc.ts";
import { searchKnowledge, type KnowledgeEntry } from "../rag/search.ts";
import { DISEASES } from "../extract/lexicon.ts";
import type { ExtractedPerson } from "../extract/client.ts";

const LABEL_OF = new Map(DISEASES.map((d) => [d.code, d.label]));

/** 评分分项的中文名。模型会把英文键直接抄进回答里，必须在这里翻译。 */
export const SCORE_LABEL: Record<ScoreKey, string> = {
  age: "年龄",
  bmi: "体质指数",
  waist: "腰围",
  physicalActivity: "体力活动",
  diet: "蔬果摄入",
  antihypertensive: "降压药",
  highGlucose: "高血糖史",
  familyHistory: "家族史",
};

/** 用户在界面上填的体检与生活方式数字（可选——没填就只做定性汇总）。 */
export interface RiskFactors {
  age: number;
  sex: "male" | "female";
  bmi: number;
  waistCm: number;
  physicallyActive: boolean;
  eatsVegetablesDaily: boolean;
  onAntihypertensive: boolean;
  historyOfHighGlucose: boolean;
}

export interface ToolContext {
  persons: ExtractedPerson[];
  factors: RiskFactors | null;
  kb: KnowledgeEntry[];
}

/** 风险量化的结构化结果——界面直接用这些数字，不经过模型。 */
export interface RiskFact {
  score: number;
  percent: number;
  band: string;
  reclaimablePoints: number;
  goalScore: number;
  goalPercent: number;
  /** 可改变项明细（只含用户能改的） */
  items: Array<{ label: string; points: number }>;
}

/** 把抽取结果转成家系树。这里只用到 relation 与疾病，故不填证据类字段。 */
export function toFamilyTree(persons: ExtractedPerson[]): FamilyTree {
  const map: Record<string, Person> = {};
  persons.forEach((p, i) => {
    const id = `p${i}`;
    map[id] = {
      id,
      sex: p.sex ?? "unknown",
      deceased: "unknown",
      relation: p.relation as RelationType,
      conditions: p.conditions.map((c) => ({
        code: c.code,
        rawText: "",
        onsetAge:
          c.onsetAge === null ? undefined : { value: c.onsetAge, certainty: "approx" as const },
        source: "",
        confidence: 1,
      })),
    };
  });
  return { probandId: "__none__", persons: map };
}

/** FINDRISC 的家族史条目只分三档：一级 / 二级 / 无。 */
export function familyHistoryLevel(persons: ExtractedPerson[]): "first" | "second" | "none" {
  const tree = toFamilyTree(persons);
  const s = summarizeFamilyHistory(tree, "type2-diabetes");
  if (s.firstDegreeCount > 0) return "first";
  if (s.secondDegreeCount > 0) return "second";
  return "none";
}

export interface ToolResult {
  /** 给模型看的观察结果，必须短——本地模型上下文只有 4096。 */
  observation: string;
  /** 本次真实检索到的条目标题，用于校验回答里的「依据」。 */
  citations?: string[];
  /** 条目标题 → 出处（把「依据」补成可核对的引用，而不是只给一个标题） */
  citationSources?: Record<string, string>;
  /** 结构化的家族史摘要，界面直接展示。 */
  pedigree?: string[];
  /** 结构化的风险结果，界面直接展示。 */
  risk?: RiskFact;
}

export type ToolName =
  | "summarize_pedigree"
  | "compute_risk"
  | "search_knowledge"
  | "final_answer";

/**
 * 工具使用说明（会拼进 system prompt）。
 * 每条都写清「什么时候该用」，否则 1.7B 会一直重复调用同一个工具。
 */
export const TOOL_SPEC = `可用工具：
1. summarize_pedigree（无参数）——汇总已录入的家族史：哪些病、几级亲属、几岁发病。
2. compute_risk（无参数）——计算本人未来 10 年 2 型糖尿病风险，以及其中有多少分可以靠生活方式拿回来。
3. search_knowledge（参数：检索词）——在已核实的健康知识库里查依据。
4. final_answer（参数：回答正文）——给出最终回答并结束。`;

/** 执行一个工具。input 是被调用工具的参数（目前只有 search_knowledge 用得上）。 */
export function runTool(name: ToolName, input: string, ctx: ToolContext): ToolResult {
  if (name === "summarize_pedigree") {
    if (ctx.persons.length === 0) {
      return { observation: "还没有录入任何亲属。需要先请用户描述家里人的情况。" };
    }
    const tree = toFamilyTree(ctx.persons);
    const codes = [
      ...new Set(ctx.persons.flatMap((p) => p.conditions.map((c) => c.code))),
    ];

    const lines = codes.map((code) => {
      const s = summarizeFamilyHistory(tree, code);
      const label = LABEL_OF.get(code) ?? code;
      const parts: string[] = [];
      if (s.firstDegreeCount > 0) parts.push(`一级 ${s.firstDegreeCount} 人`);
      if (s.secondDegreeCount > 0) parts.push(`二级 ${s.secondDegreeCount} 人`);
      const onset = s.earliestFirstDegreeOnset
        ? `，一级亲属最早 ${s.earliestFirstDegreeOnset.value} 岁发病`
        : "";
      return `${label}：${parts.join("、")}${onset}`;
    });

    return {
      observation: `共 ${ctx.persons.length} 位亲属，${codes.length} 种病。\n${lines.join("\n")}`,
      pedigree: lines,
    };
  }

  if (name === "compute_risk") {
    if (!ctx.factors) {
      return {
        observation:
          "用户还没有填写年龄、身高体重、腰围等体检数字，无法计算风险。可以先回答问题，并提示补充这些数字。",
      };
    }
    const r = evaluateFindrisc({
      ...ctx.factors,
      familyHistory: familyHistoryLevel(ctx.persons),
    });

    // 只列可改变项。之前把 familyHistory / age 也列进来了，
    // 等于告诉用户「家族史这 3 分你可以拿回来」——这是错的，会误导。
    const items = MODIFIABLE_KEYS.map((k) => ({
      label: SCORE_LABEL[k],
      points: r.breakdown[k],
    })).filter((x) => x.points > 0);

    return {
      observation:
        `FINDRISC ${r.score} 分 → 未来 10 年风险 ${r.current.tenYearRiskPercent}%。` +
        `\n其中可回收 ${r.reclaimablePoints} 分（${items.map((x) => `${x.label} ${x.points} 分`).join("、")}）。` +
        `\n若这些全部达标：${r.bestAchievableScore} 分 → ${r.best.tenYearRiskPercent}%。`,
      risk: {
        score: r.score,
        percent: r.current.tenYearRiskPercent,
        band: r.current.band,
        reclaimablePoints: r.reclaimablePoints,
        goalScore: r.bestAchievableScore,
        goalPercent: r.best.tenYearRiskPercent,
        items,
      },
    };
  }

  if (name === "search_knowledge") {
    const hits = searchKnowledge(input, ctx.kb, 2);
    if (hits.length === 0) {
      return { observation: "知识库里没有与此相关的条目。不要猜测，如实告知用户查不到。" };
    }
    return {
      observation:
        hits.map((h) => `《${h.title}》${h.text}（出处：${h.source}）`).join("\n") +
        "\n（已检索到内容，请直接据此作答，不要换措辞重复检索。）",
      citations: hits.map((h) => h.title),
      citationSources: Object.fromEntries(hits.map((h) => [h.title, h.source])),
    };
  }

  // final_answer
  return { observation: input };
}
