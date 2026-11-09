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
import { DecisionUnavailable, pickChoice, systemone } from "./client.ts";
import type { CallOptions } from "./client.ts";
import type { ChoiceQuestion, SystemOneRequest } from "./types.ts";

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
  /** model = 决策模型；rules = 兜底 */
  source: "model" | "rules";
  reason: string;
}

const QUESTION_ID = "hereditary-mode";

const CRITERIA: Record<string, string | null> = {
  "autosomal-dominant": "每代都有患者，男女均可发病",
  "autosomal-recessive": "同辈多发、父母可无症状，近亲婚配更常见",
  "x-linked": "男性患者明显偏多，无男传男，母系表亲可受累",
  mitochondrial: "母系传递，母亲患病则子女多受累，父亲患病不传给子女",
  insufficient: "信息不足以下判断（亲属数、发病年龄、性别有缺口）",
};

export function buildHereditaryQuestion(persons: ExtractedPerson[]): SystemOneRequest {
  const state = persons.map((p) => ({
    relation: p.relation,
    sex: p.sex,
    conditions: (p.conditions ?? []).map((c) => ({ code: c.code, onsetAge: c.onsetAge })),
  }));
  const q: ChoiceQuestion = {
    type: "choice",
    instructions:
      "这是一个家系：state 里列出每位亲属的关系、性别与所患疾病（onsetAge 为发病年龄，可为 null）。" +
      "请判断该家系最符合哪种遗传模式。若亲属数量、发病年龄或性别信息不足以区分，请选择 insufficient，" +
      "不要为了给出结论而猜测。",
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

export async function decideHereditary(
  persons: ExtractedPerson[],
  opts: CallOptions = {},
): Promise<HereditaryDecision> {
  const req = buildHereditaryQuestion(persons);
  let res;
  try {
    res = await systemone(req, opts);
  } catch (e) {
    if (e instanceof DecisionUnavailable) return ruleDecision(persons);
    throw e;
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
