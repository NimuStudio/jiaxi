/**
 * typed decision model 客户端（llama.cpp /v1/systemone，兼容 TypeSafe API）
 *
 * 协议依据见 ml/tools/src/llama.cpp-master/tools/server/README.md 的
 * 「POST /v1/systemone」一节：无流式、一次前向、按 question 返回概率。
 *
 * 刻意保持薄：只做「发请求 + 校验响应」，不掺领域逻辑。
 * 校验是必需的——概率和不为 1、choice 不在候选里这类错误一旦漏过去，
 * 上层会拿一个假结论去做医疗判断。
 */

import type { Answer, SystemOneRequest, SystemOneResponse } from "./types.ts";

export const DECISION_URL = process.env.DECISION_SERVER_URL ?? "";

export class DecisionUnavailable extends Error {}

export interface CallOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function fail(msg: string): never {
  throw new Error(msg);
}

/** 校验 choice 答案：choice 必须在候选里，概率和为 1（允许浮点误差） */
function checkChoice(a: Record<string, unknown>, criteria: string[]): void {
  const choice = a.choice;
  if (typeof choice !== "string" || !criteria.includes(choice)) {
    fail(`choice 不在候选内: ${String(choice)}`);
  }
  const probs = a.probabilities;
  if (!probs || typeof probs !== "object") fail("缺少 probabilities");
  let sum = 0;
  for (const key of criteria) {
    const v = (probs as Record<string, unknown>)[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      fail(`概率非法: ${key}=${String(v)}`);
    }
    sum += v;
  }
  if (Math.abs(sum - 1) > 0.02) fail(`概率和不为 1: ${sum.toFixed(3)}`);
}

export function validateAnswers(
  req: SystemOneRequest,
  res: SystemOneResponse,
): void {
  if (!res || typeof res !== "object" || !res.answers) fail("响应缺少 answers");
  for (const [id, q] of Object.entries(req.questions)) {
    const a = res.answers[id] as Record<string, unknown> | undefined;
    if (!a) fail(`缺少 answer: ${id}`);
    if (q.type === "choice") checkChoice(a, Object.keys(q.criteria));
    if (q.type === "noul" && (typeof a.noul !== "number" || a.noul < 0 || a.noul > 1)) {
      fail(`noul 非法: ${String(a.noul)}`);
    }
  }
}

export async function systemone(
  req: SystemOneRequest,
  opts: CallOptions = {},
): Promise<SystemOneResponse> {
  const base = opts.baseUrl ?? DECISION_URL;
  if (!base) throw new DecisionUnavailable("未配置 DECISION_SERVER_URL");
  const doFetch = opts.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await doFetch(`${base.replace(/\/$/, "")}/v1/systemone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: ctl.signal,
    });
    // 501 = 该模型不是决策模型；400 = 请求不合法。两种都当作「不可用」，交给兜底
    if (res.status === 501) throw new DecisionUnavailable("服务端模型不是决策模型");
    if (!res.ok) throw new DecisionUnavailable(`systemone 返回 ${res.status}`);
    const json = (await res.json()) as SystemOneResponse;
    validateAnswers(req, json);
    return json;
  } catch (e) {
    if (e instanceof DecisionUnavailable) throw e;
    throw new DecisionUnavailable(
      e instanceof Error ? e.message : "调用决策模型失败",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** 探测服务端是否有可用的决策模型（看 /v1/models 的 output_modalities） */
export async function hasDecisionModel(
  opts: CallOptions = {},
): Promise<boolean> {
  const base = opts.baseUrl ?? DECISION_URL;
  if (!base) return false;
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${base.replace(/\/$/, "")}/v1/models`, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 2000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as {
      data?: Array<{ architecture?: { output_modalities?: string[] } }>;
    };
    return (json.data ?? []).some((m) =>
      (m.architecture?.output_modalities ?? []).includes("decisions"),
    );
  } catch {
    return false;
  }
}

export function pickChoice(
  res: SystemOneResponse,
  id: string,
): { choice: string; confidence: number; probabilities: Record<string, number> } {
  const a = res.answers[id] as Extract<Answer, { type: "choice" }>;
  return { choice: a.choice, confidence: a.confidence, probabilities: a.probabilities };
}
