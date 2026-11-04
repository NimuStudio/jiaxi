/**
 * 本地大模型调用层（llama.cpp server）
 *
 * 走 llama-server 的 OpenAI 兼容接口，但额外带两个 llama.cpp 特有参数：
 *  - grammar：GBNF 约束，保证输出是合法 JSON
 *  - chat_template_kwargs.enable_thinking：关掉 Qwen3 的思考模式（抽取任务不需要）
 *
 * 为什么不用云 API：
 *  1. 家族病史是敏感信息，本地推理意味着它不出这台机器；
 *  2. 约束解码只有本地运行时才有，云端只能靠 prompt 祈祷；
 *  3. 比赛评审期不依赖外部额度与网络。
 */

import { PEDIGREE_GBNF } from "./grammar.ts";

const LLM_URL = process.env.LLAMA_SERVER_URL ?? "http://127.0.0.1:8080";

export interface ExtractedCondition {
  code: string;
  onsetAge: number | null;
}

export interface ExtractedPerson {
  relation: string;
  sex: "male" | "female" | "unknown";
  conditions: ExtractedCondition[];
}

export interface ExtractResult {
  persons: ExtractedPerson[];
}

const SYSTEM_PROMPT = `你是家系信息抽取器。把用户说的家族病史转成 JSON。
规则：
1. 只抽取明确提到的亲属，不要推测没提到的。
2. 年龄记不清就填 null，不要编。
3. 直接输出 JSON。`;

/**
 * Few-shot 示例。选的都是最容易错的地方：
 * 口语指代（老娘=母亲）、疾病俗称（放支架=冠心病）、父系母系区分（奶奶/外婆）。
 */
const FEW_SHOT: Array<{ role: "user" | "assistant"; content: string }> = [
  {
    role: "user",
    content: "我爸 50 岁心梗，我奶奶有糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"myocardial-infarction","onsetAge":50}]},{"relation":"paternal-grandmother","sex":"female","conditions":[{"code":"type2-diabetes","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我老娘是脑溢血走的，走的时候六十来岁。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"mother","sex":"female","conditions":[{"code":"stroke","onsetAge":60}]}]}',
  },
];

/** 检查本地推理服务是否可用。 */
export async function isLlmReady(): Promise<boolean> {
  try {
    const res = await fetch(`${LLM_URL}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ok";
  } catch {
    return false;
  }
}

/**
 * 从一段口语描述里抽取家系节点。
 * 抛错时带上原始输出，方便定位是语法问题还是模型问题。
 */
export async function extractPedigree(text: string): Promise<ExtractResult> {
  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...FEW_SHOT,
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 512,
      cache_prompt: true,
      grammar: PEDIGREE_GBNF,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!res.ok) {
    throw new Error(`llama-server ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content ?? "";

  try {
    return JSON.parse(content) as ExtractResult;
  } catch {
    throw new Error(`约束解码仍返回了非 JSON（不应发生）：${content.slice(0, 200)}`);
  }
}
