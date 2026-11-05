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

export const LLM_URL = process.env.LLAMA_SERVER_URL ?? "http://127.0.0.1:8080";

/**
 * 模型输出的是中文病名（见 grammar.ts 的说明），这里映射回内部编码。
 * 映射范围与 GBNF 枚举一致：规范标签 + 名词性别名，
 * 所以模型照抄原文的口语说法（「肿瘤」「瘤子」）也能落回同一个编码。
 */
const LABEL_TO_CODE = new Map(
  DISEASES.flatMap((d) => [
    [d.label, d.code] as const,
    ...d.nounAliases.map((a) => [a, d.code] as const),
  ]),
);

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
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"心梗","onsetAge":50}]}]}',
  },
  {
    role: "user",
    content: "我爹有高血压，还有糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"高血压","onsetAge":null},{"code":"糖尿病","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我老娘是脑溢血走的，六十来岁。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"mother","sex":"female","conditions":[{"code":"脑卒中","onsetAge":60}]}]}',
  },
  {
    role: "user",
    content: "我爷爷有糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-grandfather","sex":"male","conditions":[{"code":"糖尿病","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我外婆是肺癌走的。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"肺癌","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "舅舅前年查出糖尿病，四十多岁。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-uncle","sex":"male","conditions":[{"code":"糖尿病","onsetAge":45}]}]}',
  },
  {
    role: "user",
    content: "我姑姑 62 岁查出肠癌。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-aunt","sex":"female","conditions":[{"code":"肠癌","onsetAge":62}]}]}',
  },
  {
    role: "user",
    content: "外婆和姨妈都有乳腺癌，姨妈 48 岁确诊的。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"乳腺癌","onsetAge":null}]},{"relation":"maternal-aunt","sex":"female","conditions":[{"code":"乳腺癌","onsetAge":48}]}]}',
  },
  {
    role: "user",
    content: "我叔叔 50 岁那年心梗，我妈身体还行。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-uncle","sex":"male","conditions":[{"code":"心梗","onsetAge":50}]}]}',
  },
  {
    role: "user",
    content: "我奶奶高血压，我姥姥糖尿病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-grandmother","sex":"female","conditions":[{"code":"高血压","onsetAge":null}]},{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"糖尿病","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我妹妹有高血压。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"sister","sex":"female","conditions":[{"code":"高血压","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我姥姥前年走的，尿毒症。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-grandmother","sex":"female","conditions":[{"code":"慢性肾病","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我爸和我大伯都有冠心病。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"father","sex":"male","conditions":[{"code":"冠心病","onsetAge":null}]},{"relation":"paternal-uncle","sex":"male","conditions":[{"code":"冠心病","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我外公那人，血糖高。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"maternal-grandfather","sex":"male","conditions":[{"code":"糖尿病","onsetAge":null}]}]}',
  },
  {
    role: "user",
    content: "我妈身体还行。",
  },
  {
    role: "assistant",
    content: '{"persons":[]}',
  },
  {
    // 泛称病名：教模型输出「癌症」而不是瞎猜成具体癌种。
    // 这类词表外的说法最容易整句漏掉，必须给模型一个示范。
    role: "user",
    content: "我大伯得了肿瘤，五十多岁。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-uncle","sex":"male","conditions":[{"code":"癌症","onsetAge":null}]}]}',
  },
  {
    // 词表外的具体病名：归「其他」，不要硬套成最接近的已知病。
    role: "user",
    content: "我三叔有肝硬化。",
  },
  {
    role: "assistant",
    content:
      '{"persons":[{"relation":"paternal-uncle","sex":"male","conditions":[{"code":"其他","onsetAge":null}]}]}',
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
  /**
   * 阶段进度回调（SSE 推给前端的「AI 思考状态可视化」）。
   * 纯观察者：不传时行为与原来完全一致。
   */
  onStage?: (stage: ExtractStage) => void;
}

/** 抽取过程的可观察阶段事件。 */
export type ExtractStage =
  | { type: "split"; total: number; segments: string[] }
  | { type: "segment"; index: number; total: number; segment: string }
  | { type: "merged"; persons: number };

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
 * 证据校验：只保留原文中真的出现过的疾病。
 *
 * 模型的幻觉在医疗场景里代价很高（多出一个「脑卒中」，下游筛查建议就变了）。
 * 约束解码能保证 JSON 合法，但保证不了内容有依据。所以这里加一道硬校验：
 * 每个抽出来的病，必须能在原句里找到对应的说法，找不到就删除。
 * 没有对应词条的编码（如 other）不参与校验，原样保留。
 */
function dropUnmentioned(segment: string, person: ExtractedPerson): ExtractedPerson {
  const kept = person.conditions.filter((c) => {
    const spec = DISEASES.find((d) => d.code === c.code);
    if (!spec) return true;
    const aliases = [...spec.nounAliases, ...(spec.verbAliases ?? [])];
    // 没有词条的编码（如 other）无从校验，保留原判
    if (aliases.length === 0) return true;
    return aliases.some((a) => segment.includes(a));
  });
  // 全被丢掉但原句里确有疾病词：用词表兜底，避免"什么都不剩"
  if (kept.length === 0 && person.conditions.length > 0) {
    const rescued = rescueCondition(segment);
    if (rescued) return { ...person, conditions: [rescued] };
  }
  return { ...person, conditions: kept };
}

const CN_DIGIT: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};

/** 原文里出现过的所有数字（阿拉伯 + 中文 1~99），用于校验模型给的发病年龄 */
export function agesInText(text: string): number[] {
  const found = new Set<number>();
  for (const m of text.matchAll(/\d+/g)) found.add(Number(m[0]));
  for (const tok of text.match(/[一二三四五六七八九十]+/g) ?? []) {
    let val = -1;
    if (tok.includes("十")) {
      const [a, b] = tok.split("十");
      const tens = a ? (CN_DIGIT[a] ?? 0) : 1;
      const ones = b ? (CN_DIGIT[b] ?? 0) : 0;
      val = tens * 10 + ones;
    } else if (tok.length === 1) {
      val = CN_DIGIT[tok] ?? -1;
    }
    if (val > 0) found.add(val);
  }
  return [...found];
}

/**
 * 发病年龄必须能在原文里找到，否则置空。
 *
 * 为什么会编：实测「我大伯胃癌，做完手术了。」模型吐出 onsetAge=50——原句没有任何年龄。
 * 而年龄是 FINDRISC 与 China-PAR 的**核心输入**，编一个数会直接改变风险结论，
 * 这是比"抽错病名"更危险的错误，因此在这里硬性接地。
 */
export function groundAge(segment: string, age: number | null): number | null {
  if (age == null) return null;
  return agesInText(segment).includes(age) ? age : null;
}

/**
 * 病名被"必须能回查原文"校验丢掉后的兜底：用词表在原文里找最长命中。
 *
 * 场景：「我爷爷肝癌走的。」模型把病名泛化成「癌症」，而原句里没有「癌症」二字，
 * 校验于是把整条抽掉，结果什么都没留下。这里用词表兜底——命中的别名**就在原文里**，
 * 属于确定性证据，不是猜测；找不到就保持为空。
 */
export function rescueCondition(segment: string): ExtractedCondition | null {
  let best: { code: string; alias: string } | null = null;
  for (const d of DISEASES) {
    for (const a of [...d.nounAliases, ...(d.verbAliases ?? [])]) {
      if (segment.includes(a) && (best === null || a.length > best.alias.length)) {
        best = { code: d.code, alias: a };
      }
    }
  }
  return best ? { code: best.code, onsetAge: null } : null;
}

/**
 * 一句话里两个主语共享同一个病：「我爸和我叔都心梗。」
 *
 * 模型只会抽出第一个主语，第二个整条丢失（评测集 c14 的失分点）。
 * 这里用词表补：当输出只有 1 人、句中却提到 ≥2 个亲属称谓、且出现并列词时，
 * 把这组病复制给其他被提到的亲属。条件给得很窄，避免把不同人的病串错。
 */
export function expandSharedCondition(
  segment: string,
  persons: ExtractedPerson[],
): ExtractedPerson[] {
  if (persons.length !== 1) return persons;
  const only = persons[0];
  if (!only || only.conditions.length === 0) return persons;
  if (!/(和|还有|都|、|跟)/.test(segment)) return persons;

  const mentioned = RELATIONS.filter((spec) =>
    spec.aliases.some((a) => segment.includes(a) && !isLocative(segment, a)),
  );
  if (mentioned.length < 2) return persons;

  const out: ExtractedPerson[] = [only];
  for (const spec of mentioned) {
    if (spec.relation === only.relation) continue;
    out.push({
      relation: spec.relation,
      sex: spec.sex,
      conditions: only.conditions.map((c) => ({ ...c })),
    });
  }
  return out;
}

/**
 * 从一段口语描述里抽取家系节点。
 * 抛错时带上原始输出，方便定位是语法问题还是模型问题。
 */
/**
 * 把口语说法归一成规范病名，再交给模型。
 *
 * 为什么需要：模型（Qwen3-1.7B + LoRA）对规范名词的召回远高于口语动词短语。
 * 实测「我爸五十岁放了支架」「我爸做了心脏搭桥手术」在原始措辞下都输出 other，
 * 即便把这些说法加进 GBNF 可选字面量也没有改善——模型自己就不选它们。
 * 而这两类说法在词表里是**确定的**（「放了支架」就是冠心病），交给规则归一更可靠。
 *
 * 归一后仍用原文做关系校正与"必须能回查原文"校验，展示给用户的依据不受影响。
 */
export function normalizeSegment(segment: string): string {
  const pairs: Array<[string, string]> = [];
  for (const d of DISEASES) {
    for (const a of [...d.nounAliases, ...(d.verbAliases ?? [])]) {
      if (a !== d.label && a.length >= 2) pairs.push([a, d.label]);
    }
  }
  // 长别名优先：「放了心脏支架」要在「心脏支架」之前替换，否则会残留半句
  pairs.sort((x, y) => y[0].length - x[0].length);
  let out = segment;
  for (const [alias, label] of pairs) {
    if (out.includes(alias)) out = out.split(alias).join(label);
  }
  return out;
}

export async function extractPedigree(
  text: string,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  // 送模型的是归一世后的文本；校验与关系校正仍用原始 text
  const modelInput = normalizeSegment(text);
  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_TEXT },
        ...(options.fewShot ? FEW_SHOT : []),
        { role: "user", content: modelInput },
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
    const cleaned = (parsed.persons ?? [])
      .map((p) => ({
        ...p,
        conditions: (p.conditions ?? []).map((c) => ({
          ...c,
          code: LABEL_TO_CODE.get(c.code) ?? c.code,
          onsetAge: groundAge(text, c.onsetAge ?? null),
        })),
      }))
      .map((p) => reconcileRelation(text, p))
      .map((p) => dropUnmentioned(text, p))
      .flatMap((p) => expandSharedCondition(text, [p]));

    // 模型偶尔会把同一个人输出两次（GBNF 允许数组重复），
    // 这里统一合并去重，避免上游拿到脏数据。
    return mergeResults([{ persons: cleaned }]);
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
/**
 * 片段里是否出现了亲属称谓（排除「我妈那边」这类方位指代）。
 */
function hasRelationWord(segment: string): boolean {
  return RELATIONS.some((spec) =>
    spec.aliases.some((alias) => segment.includes(alias) && !isLocative(segment, alias)),
  );
}

export function splitSegments(text: string): string[] {
  const parts = text
    .split(/[。；;]|(?<![和及与、])，/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const out: string[] = [];
  let prefix = "";

  for (const part of parts) {
    if (looksRelevant(part)) {
      if (prefix) {
        // 前面有无病名片段：它是这部分的主语
        out.push(`${prefix}，${part}`);
        prefix = "";
      } else if (out.length > 0 && !hasRelationWord(part)) {
        // 前面已有抽取片段、这部分又没有称谓：它是对上一句的延续
        // （如「我奶奶那人，血压高，后来中风了」的「后来中风了」）。
        // 当独立句送抽会丢主语，模型只能输出空——接到上一句后面。
        out[out.length - 1] = `${out[out.length - 1]}，${part}`;
      } else {
        out.push(part);
      }
    } else {
      prefix = prefix ? `${prefix}，${part}` : part;
    }
  }

  // 末尾剩余的无病名片段：若前面已有片段，说明是对上一句的补充描述
  // （如「那时候还不到六十」），接到最后一个片段后面一起抽。
  // 但片段若自带称谓（如「我妈身体还行」），那是另一个人的独立陈述，
  // 拼过去会让模型张冠李戴——单独留下（预筛会把它当闲聊过滤）。
  if (prefix && out.length > 0 && !hasRelationWord(prefix)) {
    out[out.length - 1] = `${out[out.length - 1]}，${prefix}`;
  }

  return out;
}

/**
 * 片段里是否出现了疾病词。
 *
 * 作用：切句后会产生「我妈那边」这类没有疾病信息的片段。
 * 这类片段如果送去抽取，小模型会凭空编一个病出来（实测出现过
 * 「我妈那边」→ maternal-uncle[乳腺癌]）。
 */
export function hasDiseaseWord(segment: string): boolean {
  return DISEASES.some((d) =>
    [...d.nounAliases, ...(d.verbAliases ?? [])].some((alias) =>
      segment.includes(alias),
    ),
  );
}

/**
 * 疾病指示词：词表没收、但暗示「这里有病」的口语信号。
 *
 * 预筛的历史教训：早期版本只认词表，词表外的一切都被当成闲聊丢弃——
 * 「我爸爸30岁有癌症」（癌症泛称当时没收录）整句消失，模型根本没机会看。
 * 规则的任务应该是**防止模型幻觉**，而不是**替模型做判断**：
 * 判断权交给模型，规则只在两头把关——
 *   前面：只拦「确定没有疾病信息」的纯闲聊，可疑的一律放行；
 *   后面：dropUnmentioned 证据校验删掉原文找不到依据的幻觉。
 */
const ILLNESS_HINTS = [
  "病",
  "癌",
  "瘤",
  "瘫",
  "查出",
  "确诊",
  "检查出",
  "去世",
  "过世",
  "走了",
  "走的",
  "没了",
  "没熬过去",
  "没挺过去",
  "住院",
  "住过院",
  "手术",
  "化疗",
  "放疗",
  "透析",
  "移植",
  "支架",
  "搭桥",
  "三高",
  "不舒服",
  "不对劲",
  "恶化",
  "复发",
  "并发症",
  "梗死",
  "硬化",
  "衰竭",
];

export function hasIllnessHint(segment: string): boolean {
  return ILLNESS_HINTS.some((h) => segment.includes(h));
}

/**
 * 片段是否值得送给模型：
 *  1. 词表命中——快路径，最常见；
 *  2. 有称谓 + 有疾病指示词——词表外的病名/说法，交给模型判断，
 *     幻觉由下游证据校验兜底。
 * 两者都不满足（如「我妈身体还行」）才是真正的闲聊。
 */
export function looksRelevant(segment: string): boolean {
  return (
    hasDiseaseWord(segment) || (hasRelationWord(segment) && hasIllnessHint(segment))
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
        // 按病种去重（而不是 code+onsetAge 精确匹配）：
        // 同一个亲属的同一病种，一次抽出带年龄、一次不带，是真实会发生的
        // （「我爷爷肺癌」与「我爷爷前年走的，肺癌」）。精确匹配会留下
        // 两条重复病情；这里保留一条，年龄取更具体（非空）的那个。
        const dup = cur.conditions.find((d) => d.code === c.code);
        if (!dup) {
          cur.conditions.push(c);
        } else if (dup.onsetAge === null && c.onsetAge !== null) {
          dup.onsetAge = c.onsetAge;
        }
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
  const { onStage } = options;
  const segments = splitSegments(text);

  // 预筛只拦「确定无疾病信息」的纯闲聊；可疑片段放行给模型，
  // 幻觉由 dropUnmentioned 证据校验兜底（词表外病名归「其他」，不参与校验）。
  const meaningful = segments.filter((s) => looksRelevant(s));
  onStage?.({
    type: "split",
    total: meaningful.length,
    segments: meaningful,
  });
  if (meaningful.length === 0) {
    return { persons: [] };
  }
  if (meaningful.length === 1) {
    onStage?.({ type: "segment", index: 1, total: 1, segment: meaningful[0] as string });
    const single = await extractPedigree(meaningful[0] as string, options);
    onStage?.({ type: "merged", persons: single.persons.length });
    return single;
  }

  const results: ExtractResult[] = [];
  let i = 0;
  for (const seg of meaningful) {
    i += 1;
    onStage?.({ type: "segment", index: i, total: meaningful.length, segment: seg });
    results.push(await extractPedigree(seg, options));
  }
  const merged = mergeResults(results);
  onStage?.({ type: "merged", persons: merged.persons.length });
  return merged;
}
