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
import { DecisionUnavailable, pickChoice, systemone } from "./client.ts";
import type { CallOptions } from "./client.ts";
import { ScoringUnavailable, scoreChoice } from "./score.ts";
import { structuralDecide } from "./structural.ts";
import type { ChoiceQuestion, SystemOneRequest } from "./types.ts";

/** 打分后端：没有决策模型权重时，用普通 LLM 的 logprob 近似 choice 原语 */
export const SCORING_URL = process.env.SCORING_SERVER_URL ?? process.env.LLAMA_SERVER_URL ?? "";

import { CONFIDENCE_FLOOR, MODE_LABEL } from "./mode.ts";
import type { HereditaryDecision, HereditaryMode } from "./mode.ts";

export { CONFIDENCE_FLOOR, MODE_LABEL };
export type { HereditaryDecision, HereditaryMode };

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

/**
 * 判不了时「缺什么」——直接用于追问。
 * 这些缺口正是模型最容易看走眼的地方（实测线粒体那例就是缺父系信息被读成显性）。
 */
export function missingInfo(persons: ExtractedPerson[]): string[] {
  const gaps: string[] = [];
  const affected = persons.filter((p) => (p.conditions ?? []).length > 0);
  if (affected.length === 0) gaps.push("还没有任何亲属的患病信息");

  const withAge = affected.filter((p) => (p.conditions ?? []).some((c) => c.onsetAge != null));
  if (affected.length > 0 && withAge.length < affected.length) {
    gaps.push(`${affected.length - withAge.length} 位患病亲属缺发病年龄`);
  }

  const sexes = new Set(affected.map((p) => p.sex).filter((s) => s !== "unknown"));
  if (affected.length > 1 && sexes.size < 2) gaps.push("患病亲属性别单一，缺另一性别的情况");

  const hasPaternal = persons.some((p) => p.relation.startsWith("paternal-") || p.relation === "father");
  const hasMaternal = persons.some((p) => p.relation.startsWith("maternal-") || p.relation === "mother");
  if (!hasPaternal) gaps.push("父系亲属是否患病");
  if (!hasMaternal) gaps.push("母系亲属是否患病");

  return gaps;
}

/** 兼容旧调用：拼成一句话 */
export function structuralFacts(persons: ExtractedPerson[]): string {
  const gaps = missingInfo(persons);
  const affected = persons.filter((p) => (p.conditions ?? []).length > 0).length;
  const head = affected > 0 ? `${affected} 位亲属有患病记录` : "";
  return [head, ...gaps].filter(Boolean).join("；");
}

export function ruleDecision(persons: ExtractedPerson[]): HereditaryDecision {
  return {
    mode: "insufficient",
    rawMode: null,
    confidence: 0,
    probabilities: {},
    source: "rules",
    reason: structuralFacts(persons),
    gaps: missingInfo(persons),
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
  // 只认 SCORING_URL：opts.baseUrl 指向的是决策模型服务器，不是文本模型
  const base = SCORING_URL;
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
        gaps: missingInfo(persons),
      };
    }
    return {
      mode,
      rawMode: mode,
      confidence: r.confidence,
      probabilities: r.probabilities as Partial<Record<HereditaryMode, number>>,
      source: "scored",
      reason: `logprob 打分置信度 ${(r.confidence * 100).toFixed(0)}%`,
      gaps: missingInfo(persons),
    };
  } catch (e) {
    if (e instanceof ScoringUnavailable) return null;
    throw e;
  }
}

/** 本地结构模型：毫秒级，权重来自 ml/train_inheritance_lr.py（同批测试集 88%） */
const STRUCTURAL_FLOOR = 0.7;

/**
 * 默认后端 = 本地结构模型。
 *
 * 依据（同一批均衡 25 条、每类 5 条，ml/out/inheritance_eval.json）：
 *   OpenJev-Q4（18.5 GB，单次 6.3 s）40%
 *   结构逻辑回归（12 维，毫秒级）      96%
 * OpenJev 在隐性 / X 连锁 / 线粒体三类上全错（一律判成证据不足或显性），
 * 它是通用决策模型，没有遗传学先验；而这个任务本来就由家系结构决定。
 * 需要对比 / 演示 JEV 协议时用 INHERITANCE_BACKEND=model 打开。
 */
export const BACKEND = process.env.INHERITANCE_BACKEND ?? "structural";
export const USE_DECISION_MODEL = BACKEND === "model";

function decideByStructure(persons: ExtractedPerson[]): HereditaryDecision {
  const r = structuralDecide(persons);
  if (r.confidence < STRUCTURAL_FLOOR && r.mode !== "insufficient") {
    return {
      mode: "insufficient",
      rawMode: r.mode,
      confidence: r.confidence,
      probabilities: r.probabilities as Partial<Record<HereditaryMode, number>>,
      source: "structural",
      reason: `结构模型倾向「${MODE_LABEL[r.mode]}」但只有 ${(r.confidence * 100).toFixed(0)}%，不足以采信`,
      gaps: missingInfo(persons),
    };
  }
  return {
    mode: r.mode,
    rawMode: r.mode,
    confidence: r.confidence,
    probabilities: r.probabilities as Partial<Record<HereditaryMode, number>>,
    source: "structural",
    reason: `结构模型置信度 ${(r.confidence * 100).toFixed(0)}%`,
    gaps: missingInfo(persons),
  };
}

export interface DecideOptions extends CallOptions {
  /** 覆盖默认后端：测试与对比实验用，部署时看 INHERITANCE_BACKEND */
  backend?: "model" | "structural";
}

export async function decideHereditary(
  persons: ExtractedPerson[],
  opts: DecideOptions = {},
): Promise<HereditaryDecision> {
  // 默认走结构模型；只有显式要求时才碰 18.5 GB 的大模型
  const useModel = (opts.backend ?? BACKEND) === "model";
  if (!useModel) return decideByStructure(persons);

  const req = buildHereditaryQuestion(persons);
  let res;
  try {
    res = await systemone(req, opts);
  } catch (e) {
    if (!(e instanceof DecisionUnavailable)) throw e;
    // 没有决策模型：先退到本地结构模型（实测比 logprob 打分可靠），
    // 连权重都没有才退回结构事实
    if (typeof structuralDecide === "function") {
      try {
        return decideByStructure(persons);
      } catch {
        /* 权重异常就继续往下兜底 */
      }
    }
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
      gaps: missingInfo(persons),
    };
  }

  return {
    mode,
    rawMode: mode,
    confidence,
    probabilities: probs,
    source: "model",
    reason: `置信度 ${(confidence * 100).toFixed(0)}%`,
    gaps: [],
  };
}
