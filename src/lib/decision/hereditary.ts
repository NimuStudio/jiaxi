/**
 * 遗传模式判定：把家系结构交给 typed decision model 做「五选一」，而不是让模型写一段话。
 *
 * 为什么值得用决策模型：
 *  - 遗传模式本来就是有限选项，硬生成一段推理既不可信也无法评测；
 *  - 决策模型给的是每个模式的概率，低置信度时可以老实说「证据不足」并触发追问；
 *  - 医疗场景里「我不确定」比「猜一个」值钱。
 *
 * 兜底原则：没有决策模型（或概率不够）时，只输出 insufficient + 结构事实，
 * 绝不按经验拍一个模式出来——这个项目里不编数字是底线。
 */

import type { ExtractedPerson } from "../extract/client.ts";
import { RELATION_LABEL } from "../pedigree/viz.ts";
import type { RelationType } from "../pedigree/types.ts";
import { DISEASES } from "../extract/lexicon.ts";

/**
 * 给模型看的病名取「最长名词说法」：界面上是「心梗」，但实测同一家系
 * 用「心肌梗死」时模型给显性 66%，用「心梗」只有 37% —— 决策模型对术语完整度敏感。
 */
const FULL_NAME = new Map(
  DISEASES.map((d) => {
    const longest = [d.label, ...(d.nounAliases ?? [])].sort((a, b) => b.length - a.length)[0]!;
    return [d.code, longest] as const;
  }),
);
import { DecisionUnavailable, pickChoice, systemone, DECISION_URL } from "./client.ts";
import type { CallOptions } from "./client.ts";
import { ScoringUnavailable, scoreChoice } from "./score.ts";
import type { ChoiceQuestion, SystemOneRequest } from "./types.ts";

/** 打分后端：没有决策模型权重时，用普通 LLM 的 logprob 近似 choice 原语 */
export const SCORING_URL = process.env.SCORING_SERVER_URL ?? process.env.LLAMA_SERVER_URL ?? "";

export type HereditaryMode =
  | "autosomal-dominant"
  | "autosomal-recessive"
  | "x-linked"
  | "mitochondrial"
  | "insufficient";

export const MODE_LABEL: Record<HereditaryMode, string> = {
  "autosomal-dominant": "常染色体显性",
  "autosomal-recessive": "常染色体隐性",
  "x-linked": "X 连锁",
  mitochondrial: "线粒体遗传",
  insufficient: "证据不足",
};

/** 低于这个置信度就不给结论，只报「证据不足」 */
export const CONFIDENCE_FLOOR = 0.55;

export interface HereditaryDecision {
  mode: HereditaryMode;
  /** 模型原始给出的众数选项（可能被置信度门槛否掉） */
  rawMode: HereditaryMode | null;
  confidence: number;
  probabilities: Partial<Record<HereditaryMode, number>>;
  /** model = 真决策模型；scored = logprob 近似；rules = 兜底 */
  source: "model" | "scored" | "rules";
  reason: string;
}

const QUESTION_ID = "hereditary-mode";

/**
 * 选项描述一律留空（协议里 criteria 的 value 允许为 null）。
 * 实测：给每个模式配「每代都有患者、男女均可发病」这类解释，等于把判据提前塞给模型，
 * 同一家系的显性概率从 66% 掉到 40% —— 它开始对着描述逐条打勾，而不是读病史。
 */
const CRITERIA: Record<string, string | null> = {
  "autosomal-dominant": null,
  "autosomal-recessive": null,
  "x-linked": null,
  mitochondrial: null,
  insufficient: null,
};

/** 内部代码翻成人话——把 `myocardial-infarction` 这种直接喂给模型，它会判不出来 */
function describePerson(p: ExtractedPerson): string {
  const relation = RELATION_LABEL[p.relation as RelationType] ?? p.relation;
  const sex = p.sex === "male" ? "男" : p.sex === "female" ? "女" : "性别未知";
  const conds = (p.conditions ?? []).map((c) => {
    const label = FULL_NAME.get(c.code) ?? c.code;
    return c.onsetAge == null ? label : `${label}（${c.onsetAge} 岁发病）`;
  });
  return `${relation}（${sex}）：${conds.length ? conds.join("、") : "无患病记录"}`;
}

export function buildHereditaryQuestion(persons: ExtractedPerson[]): SystemOneRequest {
  const state = [
    "这是一个家系的病史（只列出用户提到的亲属）：",
    ...persons.map((p) => `- ${describePerson(p)}`),
    "未列出的亲属没有信息，请勿假定他们患病或健康。",
  ].join("\n");
  const q: ChoiceQuestion = {
    type: "choice",
    // 指令必须是纯中文：实测夹带「onsetAge 为发病年龄，可为 null」这类字段说明，
    // 同一个家系的显性概率从 66% 掉到 48%（模型被 JSON 措辞带偏）
    instructions:
      "上面是一个家系的病史。请判断最可能的遗传模式；" +
      "若亲属数量、发病年龄或性别信息不足以区分，请选「证据不足」，不要猜测。",
    criteria: CRITERIA,
  };
  return { state, questions: { [QUESTION_ID]: q } };
}

/** 结构事实，兜底时给用户看「为什么判不了」 */
export function structuralFacts(persons: ExtractedPerson[]): string {
  const affected = persons.filter((p) => (p.conditions ?? []).length > 0);
  if (affected.length === 0) return "还没有任何亲属的患病信息";
  const withAge = affected.filter((p) => (p.conditions ?? []).some((c) => c.onsetAge != null));
  const parts = [`${affected.length} 位亲属有患病记录`];
  if (withAge.length < affected.length) {
    parts.push(`其中 ${affected.length - withAge.length} 位缺发病年龄`);
  }
  const sexes = new Set(affected.map((p) => p.sex).filter((s) => s !== "unknown"));
  if (sexes.size < 2) parts.push("患病亲属性别单一，无法比较男女比例");
  return parts.join("；");
}

export function ruleDecision(persons: ExtractedPerson[]): HereditaryDecision {
  return {
    mode: "insufficient",
    rawMode: null,
    confidence: 0,
    probabilities: {},
    source: "rules",
    reason: structuralFacts(persons),
  };
}

/** 打分用的答案词：首字必须互不相同，否则首 token 概率会串 */
const PROBES: Array<{ key: HereditaryMode; probe: string }> = [
  { key: "autosomal-dominant", probe: "显性" },
  { key: "autosomal-recessive", probe: "隐性" },
  { key: "x-linked", probe: "X连锁" },
  { key: "mitochondrial", probe: "线粒体" },
  { key: "insufficient", probe: "不确定" },
];

function scoringPrompt(persons: ExtractedPerson[]): string {
  const lines = persons.map((p) => {
    const conds = (p.conditions ?? [])
      .map((c) => (c.onsetAge == null ? c.code : `${c.code}（${c.onsetAge} 岁）`))
      .join("、");
    return `- ${p.relation}（${p.sex === "male" ? "男" : p.sex === "female" ? "女" : "性别未知"}）：${conds || "无患病记录"}`;
  });
  return [
    "下面是一个家系的病史。请判断最可能的遗传模式，只回答一个词。",
    ...lines,
    "可选：显性 / 隐性 / X连锁 / 线粒体 / 不确定",
    "结论：",
  ].join("\n");
}

async function decideByScoring(
  persons: ExtractedPerson[],
  opts: CallOptions,
): Promise<HereditaryDecision | null> {
  const base = opts.baseUrl && opts.baseUrl !== DECISION_URL ? SCORING_URL : SCORING_URL;
  if (!base) return null;
  try {
    const r = await scoreChoice(scoringPrompt(persons), PROBES, {
      baseUrl: base,
      timeoutMs: opts.timeoutMs,
      fetchImpl: opts.fetchImpl,
    });
    const mode = r.choice as HereditaryMode;
    // 近似打分比真决策模型更容易「自信地错」，门槛单独抬高
    const floor = 0.8;
    if (r.confidence < floor && mode !== "insufficient") {
      return {
        mode: "insufficient",
        rawMode: mode,
        confidence: r.confidence,
        probabilities: r.probabilities as Partial<Record<HereditaryMode, number>>,
        source: "scored",
        reason: `打分倾向「${MODE_LABEL[mode]}」但只有 ${(r.confidence * 100).toFixed(0)}%，不足以采信`,
      };
    }
    return {
      mode,
      rawMode: mode,
      confidence: r.confidence,
      probabilities: r.probabilities as Partial<Record<HereditaryMode, number>>,
      source: "scored",
      reason: `logprob 打分置信度 ${(r.confidence * 100).toFixed(0)}%`,
    };
  } catch (e) {
    if (e instanceof ScoringUnavailable) return null;
    throw e;
  }
}

export async function decideHereditary(
  persons: ExtractedPerson[],
  opts: CallOptions = {},
): Promise<HereditaryDecision> {
  const req = buildHereditaryQuestion(persons);
  let res;
  try {
    res = await systemone(req, opts);
  } catch (e) {
    if (!(e instanceof DecisionUnavailable)) throw e;
    // 没有决策模型：退到 logprob 同构打分，再不行才用结构事实
    const scored = await decideByScoring(persons, opts);
    return scored ?? ruleDecision(persons);
  }

  const { choice, confidence, probabilities } = pickChoice(res, QUESTION_ID);
  const mode = choice as HereditaryMode;
  const probs = probabilities as Partial<Record<HereditaryMode, number>>;

  // 置信度不够时不给结论：模型自己也拿不准，就不该让它替用户下判断
  if (confidence < CONFIDENCE_FLOOR && mode !== "insufficient") {
    return {
      mode: "insufficient",
      rawMode: mode,
      confidence,
      probabilities: probs,
      source: "model",
      reason: `模型倾向「${MODE_LABEL[mode]}」但置信度仅 ${(confidence * 100).toFixed(0)}%，不足以采信`,
    };
  }

  return {
    mode,
    rawMode: mode,
    confidence,
    probabilities: probs,
    source: "model",
    reason: `置信度 ${(confidence * 100).toFixed(0)}%`,
  };
}
