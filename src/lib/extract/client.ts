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
import { SYSTEM_PROMPT } from "./prompt.ts";

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

const SYSTEM_PROMPT_TEXT = SYSTEM_PROMPT;

/**
 * Few-shot 示例。
 *
 * 选例原则：
 *  1. 覆盖三类系统性错误——中文亲属称谓、疾病口语说法、否定/并列表达；
 *  2. **表述刻意与评测集不同**，否则等于把答案塞进上下文，指标会虚高；
 *  3. 只放最容易错的，不放简单的，控制上下文长度。
 *
 * 注意：微调后的模型不需要这些示例（这是与基线对比的关键差异）。
 */
const FEW_SHOT: Array<{ role: "user" | "assistant"; content: string }> = [
  {
    role: "user",
    content: "我爸 50 岁心梗。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"myocardial-infarction","onsetAge":50}]}]}',
  },
  {
    role: "user",
    content: "我老娘是脑溢血走的，六十来岁。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"mother","sex":"female","conditions":[{"code":"stroke","onsetAge":60}]}]}',
  },
  {
    role: "user",
    content: "我爷爷有糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-grandfather","sex":"male","conditions":[{"code":"type2-diabetes","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我外婆是肺癌走的。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"lung-cancer","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "舅舅前年查出糖尿病，四十多岁。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-uncle","sex":"male","conditions":[{"code":"type2-diabetes","onsetAge":45}]}]}',
  },
  {
    role: "user",
    content: "我姑姑 62 岁查出肠癌。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-aunt","sex":"female","conditions":[{"code":"colorectal-cancer","onsetAge":62}]}]}',
  },
  {
    role: "user",
    content: "外婆和姨妈都有乳腺癌，姨妈 48 岁确诊的。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"breast-cancer","onsetAge":null}]},{"relation":"maternal-aunt","sex":"female","conditions":[{"code":"breast-cancer","onsetAge":48}]}]}',
  },
  {
    role: "user",
    content: "我叔叔 50 岁心梗，我妈身体还行。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-uncle","sex":"male","conditions":[{"code":"myocardial-infarction","onsetAge":50}]}]}',
  },
  {
    role: "user",
    content: "我奶奶高血压，我姥姥糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-grandmother","sex":"female","conditions":[{"code":"hypertension","onsetAge":null}]},{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"type2-diabetes","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我妹妹有高血压。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"sister","sex":"female","conditions":[{"code":"hypertension","onsetAge":null}]}]}',
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

export interface ExtractOptions {
  /**
   * 是否附加 few-shot 示例。
   * 基线模型需要（否则几乎不可用）；微调后的模型不需要，上下文更短更快。
   */
  fewShot?: boolean;
}

/**
 * 从一段口语描述里抽取家系节点。
 * 抛错时带上原始输出，方便定位是语法问题还是模型问题。
 */
export async function extractPedigree(
  text: string,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_TEXT },
        ...(options.fewShot ? FEW_SHOT : []),
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
