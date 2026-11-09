/**
 * 同构打分：在没有决策模型权重时，用普通 LLM 的 logprob 复现 choice 原语
 *
 * 为什么需要：llama.cpp 的 /v1/systemone 只服务带决策头的模型（文本模型回 501）。
 * 在拿到真决策权重之前，用「候选答案词的首 token 概率」逼近同样的语义：
 *  - 每个选项给一个**首字互不相同**的答案词（显性 / 隐性 / X连锁 / 线粒体 / 不确定）
 *  - 一次前向读出 top_logprobs，取每个答案词首字的概率，再在选项间归一化
 *
 * 局限（写清楚，避免被当成真决策模型）：
 *  1. 只有首 token 参与打分，多 token 选项的后续部分没有计入；
 *  2. 概率不是模型文件里的校准温度缩放过的，只能当相对倾向看；
 *  3. 这是近似——真 JEV 的一次前向读数比这个干净。
 */

export interface ScoreOption {
  /** 内部编码（如 autosomal-dominant） */
  key: string;
  /** 答案词，首字必须与其他选项不同 */
  probe: string;
}

export interface ScoreResult {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export class ScoringUnavailable extends Error {}

export interface ScoreOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** 期望的候选词表大小，默认 40（要能覆盖所有答案词首字） */
  topN?: number;
}

const MISSING_PENALTY = 4; // 没出现在 top-N 里的选项按「比最小者再低 4 个自然对数」处理

interface TopLogprob {
  token: string;
  logprob: number;
}

function pickLogprobFor(probe: string, tops: TopLogprob[]): number | null {
  const head = probe.slice(0, 1);
  let best: number | null = null;
  for (const t of tops) {
    if (!t.token) continue;
    if (t.token.slice(0, 1) !== head) continue;
    if (best === null || t.logprob > best) best = t.logprob;
  }
  return best;
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export async function scoreChoice(
  prompt: string,
  options: ScoreOption[],
  opts: ScoreOptions = {},
): Promise<ScoreResult> {
  const base = opts.baseUrl;
  if (!base) throw new ScoringUnavailable("未配置打分服务地址");
  const doFetch = opts.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await doFetch(`${base.replace(/\/$/, "")}/v1/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctl.signal,
      body: JSON.stringify({
        prompt: `${prompt}\n答案：`,
        max_tokens: 1,
        temperature: 0,
        logprobs: opts.topN ?? 40,
      }),
    });
    if (!res.ok) throw new ScoringUnavailable(`打分服务返回 ${res.status}`);
    const json = (await res.json()) as {
      choices?: Array<{ logprobs?: { content?: Array<{ top_logprobs?: TopLogprob[] }> } }>;
    };
    const tops = json.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs ?? [];
    if (tops.length === 0) throw new ScoringUnavailable("打分服务没有返回 top_logprobs");

    const raw = options.map((o) => pickLogprobFor(o.probe, tops));
    const known = raw.filter((v): v is number => v !== null);
    if (known.length === 0) throw new ScoringUnavailable("没有任何选项词出现在候选里");
    const floor = Math.min(...known) - MISSING_PENALTY;
    const filled = raw.map((v) => (v === null ? floor : v));
    const probs = softmax(filled);

    let bestIdx = 0;
    for (let i = 1; i < probs.length; i += 1) if (probs[i]! > probs[bestIdx]!) bestIdx = i;

    const probabilities: Record<string, number> = {};
    options.forEach((o, i) => {
      probabilities[o.key] = probs[i]!;
    });

    return {
      choice: options[bestIdx]!.key,
      probabilities,
      confidence: probs[bestIdx]!,
    };
  } catch (e) {
    if (e instanceof ScoringUnavailable) throw e;
    throw new ScoringUnavailable(e instanceof Error ? e.message : "打分失败");
  } finally {
    clearTimeout(timer);
  }
}
