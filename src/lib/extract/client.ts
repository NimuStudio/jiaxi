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
import { DISEASES, RELATIONS } from "./lexicon.ts";
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
    content: "我爸 50 岁那年心梗。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"myocardial-infarction","onsetAge":50}]}]}',
  },
  {
    role: "user",
    content: "我爹有高血压，还有糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"hypertension","onsetAge":null},{"code":"type2-diabetes","onsetAge":null}]}]}',
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
    content: "我叔叔 50 岁那年心梗，我妈身体还行。",
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
  {
    role: "user",
    content: "我妈身体还行。",
  },
  {
    role: "assistant",
    content: '{"persons":[]}',
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
 * 判断某个称谓在句中是「方位指代」而不是主语。
 * 例如「我妈那边，二姨有乳腺癌」——「我妈」只是划定范围，
 * 真正的主语是二姨。若不排除，校正就会被带偏。
 */
function isLocative(segment: string, alias: string): boolean {
  const idx = segment.indexOf(alias);
  if (idx < 0) return false;
  const after = segment.slice(idx + alias.length, idx + alias.length + 2);
  return /^(那边|这边|那头|那头儿|家|老家)/.test(after);
}

/**
 * 用词表校正抽取出的关系。
 *
 * 模型经常把「老爹」抽成伯叔、「二姨」抽成舅舅，但文本里其实
 * 明确写了称谓。这时以词表为准比模型判断可靠 —— 这是一层
 * 「符号规则兜底神经模型」，比单纯信任模型稳。
 *
 * 只在句中只出现**唯一**一个称谓时校正：
 * 「我爸和我叔都心梗」这种一句两个人的，交给模型自己判断。
 */
function reconcileRelation(segment: string, person: ExtractedPerson): ExtractedPerson {
  const mentioned = new Set<string>();
  for (const spec of RELATIONS) {
    for (const alias of spec.aliases) {
      if (segment.includes(alias) && !isLocative(segment, alias)) {
        mentioned.add(spec.relation);
      }
    }
  }
  if (mentioned.size !== 1) return person;

  const target = [...mentioned][0];
  if (target === undefined || target === person.relation) return person;

  const spec = RELATIONS.find((r) => r.relation === target);
  return {
    ...person,
    relation: target,
    sex: spec ? spec.sex : person.sex,
  };
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
    const parsed = JSON.parse(content) as ExtractResult;
    // 抽取完立刻用词表校正关系——文本里写明的称谓比模型猜的更可靠。
    return {
      persons: (parsed.persons ?? []).map((p) => reconcileRelation(text, p)),
    };
  } catch {
    throw new Error(`约束解码仍返回了非 JSON（不应发生）：${content.slice(0, 200)}`);
  }
}

/**
 * 把一段话切成多个片段，并处理「主语与谓语分离」的情况。
 *
 * 真人说话经常这样：
 *   「我爷爷没熬过去，肺癌」——主语在前半句，病名在后半句
 *   「我舅舅，不对，是我叔叔，心梗过」——主语被犹豫和改口切散
 * 如果简单按标点切，后半句就丢了主语，模型只能瞎猜。
 *
 * 所以：不含疾病词的片段不丢弃，而是作为「主语前缀」累积，
 * 拼到下一个含病名的片段上。
 */
function splitSegments(text: string): string[] {
  const parts = text
    .split(/[。；;]|(?<![和及与、])，/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const out: string[] = [];
  let prefix = "";

  for (const part of parts) {
    if (hasDiseaseWord(part)) {
      out.push(prefix ? `${prefix}，${part}` : part);
      prefix = "";
    } else {
      prefix = prefix ? `${prefix}，${part}` : part;
    }
  }

  // 末尾剩余的无病名片段：若前面已有片段，说明是对上一句的补充描述
  // （如「后来中风了」），接到最后一个片段后面一起抽。
  if (prefix && out.length > 0) {
    out[out.length - 1] = `${out[out.length - 1]}，${prefix}`;
  }

  return out;
}

/**
 * 片段里是否出现了疾病词。
 *
 * 作用：切句后会产生「我妈那边」「我爸身体还行」这类没有疾病信息的片段。
 * 这类片段如果送去抽取，小模型会凭空编一个病出来（实测出现过
 * 「我妈那边」→ maternal-uncle[乳腺癌]）。直接跳过比让模型输出空更可靠，
 * 也更快。
 */
function hasDiseaseWord(segment: string): boolean {
  return DISEASES.some((d) =>
    [...d.nounAliases, ...(d.verbAliases ?? [])].some((alias) =>
      segment.includes(alias),
    ),
  );
}

/** 合并多次抽取结果：按 relation 聚合 conditions 并去重。 */
function mergeResults(results: ExtractResult[]): ExtractResult {
  const byRelation = new Map<string, ExtractedPerson>();
  for (const r of results) {
    for (const p of r.persons) {
      const cur = byRelation.get(p.relation);
      if (!cur) {
        byRelation.set(p.relation, {
          relation: p.relation,
          sex: p.sex,
          conditions: [...p.conditions],
        });
        continue;
      }
      for (const c of p.conditions) {
        const dup = cur.conditions.some(
          (d) => d.code === c.code && d.onsetAge === c.onsetAge,
        );
        if (!dup) cur.conditions.push(c);
      }
    }
  }
  return { persons: [...byRelation.values()] };
}

/**
 * 分句抽取：逐句调用模型再合并。
 *
 * 为什么需要：实测 1.7B 在「逗号分隔的多实体长句」里会漏掉第二个亲属
 * （如「奶奶高血压，姥姥糖尿病」只抽出奶奶，而「外婆和姨妈都有乳腺癌」
 * 这种并列句反而能抽全）。把句子切开后每次只处理一个亲属，准确率明显提高。
 *
 * 代价是 N 次串行调用（llama-server 单线程，并发只会排队），
 * 但单次 1–2 秒、通常 2–3 句，仍在可接受的交互延迟内。
 */
export async function extractPedigreeSplit(
  text: string,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  const segments = splitSegments(text);

  // 只有含疾病词的片段才值得抽取；否则模型会对着「我妈那边」凭空造病。
  const meaningful = segments.filter((s) => hasDiseaseWord(s));
  if (meaningful.length === 0) {
    return { persons: [] };
  }
  if (meaningful.length === 1) {
    return extractPedigree(meaningful[0] as string, options);
  }

  const results: ExtractResult[] = [];
  for (const seg of meaningful) {
    results.push(await extractPedigree(seg, options));
  }
  return mergeResults(results);
}
