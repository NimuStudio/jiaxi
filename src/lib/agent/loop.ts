/**
 * Agent 循环
 *
 * 结构：模型输出一个受约束的决策 → 执行工具 → 把观察结果喂回去 → 再决策，
 * 直到模型选择 final_answer 或到达步数上限。
 *
 * 两条设计原则（都是被 1.7B 的实际表现逼出来的）：
 *
 * 1. **工具选择用 GBNF 约束。**
 *    靠自然语言 prompt 让它选工具，实测会连续三次调同一个、或凭空编工具名。
 *    把 action 锁成枚举之后，它至少不会跑出这四个之外。
 *
 * 2. **事实与措辞分离。**
 *    模型只负责「说人话」，关键数字由工具返回结构化事实、界面直接渲染。
 *    实测它把「可回收 7 分」说成「可回收率 4%」，还编过「降低约 50% 风险」。
 *    与其反复调提示词，不如从架构上让它没机会污染数字。
 */

import { LLM_URL } from "../extract/client.ts";
import {
  TOOL_SPEC,
  runTool,
  type RiskFact,
  type ToolContext,
  type ToolName,
} from "./tools.ts";

/** 决策的 GBNF：只有一个对象，action 是四个工具之一，其余两个字段是字符串。 */
const AGENT_GBNF = String.raw`
root ::= "{" ws "\"thought\"" ws ":" ws str ws "," ws "\"action\"" ws ":" ws action ws "," ws "\"input\"" ws ":" ws str ws "}"
action ::= "\"summarize_pedigree\"" | "\"compute_risk\"" | "\"search_knowledge\"" | "\"final_answer\""
str ::= "\"" ch* "\""
ch ::= [^"\\\n\r]
ws ::= [ \t\n]*
`;

const SYSTEM_PROMPT = `你是「家系」的健康信息助手，帮助用户理解家人的病史与自己面临的风险。

${TOOL_SPEC}

输出格式（严格 JSON，不要输出任何其他内容）。示例：
{"thought":"先看已录入哪些亲属","action":"summarize_pedigree","input":""}

什么时候用哪个工具（按问题类型判断）：
- 问"风险多高 / 多少" → compute_risk
- 问"该注意什么 / 怎么办 / 怎么降低" → 第一步必须调用 compute_risk，拿到可回收项后再回答
- 问"为什么 / 依据 / 是什么 / 标准是多少" → 必须先调用 search_knowledge；检索不到就如实说查不到，不许自己编理由
- 问"家里谁得过什么" → summarize_pedigree

规则：
1. 一次只输出一个 JSON 对象。
2. 还没调用过 summarize_pedigree 时，先调用它。
3. 数字只能照抄观察里出现过的，不要自己计算或推测。
4. 知识库查不到就如实说查不到，不要猜。
5. 回答用中文，不超过 120 字，说结论和该做什么，不要复述背景。回答是一段连贯的话，不要用"1. 2. 3."编号列表。
6. 信息足够时就调用 final_answer，input 填回答正文。
7. 同一个工具最多调用一次。已经拿到结果就不要再调，直接 final_answer。
8. 「依据：」只能放在回答的最末尾、只写一个条目标题（书名号里）；没有检索到条目就不要写「依据：」。
9. compute_risk 算的是**用户本人**的风险，不是任何亲属的。回答里风险的主语永远是「你」，亲属的病只是原因，例如「因为舅舅有糖尿病（二级亲属），你的家族史记 3 分」。`;

/** 一步决策的痕迹，会显示在界面上——让「Agent 在想什么」变成可见的。 */
export interface AgentStep {
  thought: string;
  action: ToolName;
  input: string;
  observation: string;
}

/** 工具产生的结构化事实。界面用这些渲染，不经过模型。 */
export interface AgentFacts {
  risk: RiskFact | null;
  pedigree: string[];
  citations: string[];
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  facts: AgentFacts;
}

interface Decision {
  thought: string;
  action: ToolName;
  input: string;
}

// ---------------------------------------------------------------------------
// 后处理：引用校验、数字守卫
// ---------------------------------------------------------------------------

/**
 * 校验回答里的「依据：X」。
 *
 * 模型很爱顺手编一个标题（实测编出过「依据：糖尿病风险计算」这种不存在的东西）。
 * 这跟产品里「每个数字都要能点回出处」是同一条规矩：没检索到，就不许有依据。
 */
function cleanCitations(answer: string, allowed: Set<string>): string {
  // 括号形式：「（依据：X）」，不合法时整段连括号一起删掉，
  // 否则会剩下一个孤零零的「）」，看起来像 bug。
  let s = answer.replace(/[（(]\s*依据[：:]\s*([^）)]*?)\s*[）)]/g, (whole, title: string) =>
    allowed.has(title.replace(/[《》]/g, "").trim()) ? whole : "",
  );
  // 裸露形式：「依据：X」。整句一起删——只删到逗号会留下半截话
  // （实测它写过「依据：1. 家族史是……，能提示……」，删一半剩「能提示……」更像 bug）。
  s = s.replace(
    /依据[：:]\s*《?([^》\n。！？；]+?)》?(?=[。！？；\n]|$)/g,
    (whole, title: string) => (allowed.has(title.trim()) ? whole : ""),
  );
  // 带书名号但后面直接接正文（没有标点）的形式：上面那条因为前瞻要求标点会漏掉。
  // 实测模型把《0–20 分和 0–26 分是两个版本》改写成《0–26 分和 0–26 分是两个版本》，
  // 后面紧跟正文，于是这条假依据原样漏给了用户。
  s = s.replace(/依据[：:]\s*《([^》]+)》/g, (whole, title: string) =>
    allowed.has(title.trim()) ? whole : "",
  );
  return s
    // 被删掉一整句后，回答可能从「2.」这种编号断头开始——把前导编号去掉
    .replace(/^(?:\s*\d+[.、]\s*)+/, "")
    .replace(/^[，,、\s]+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/。{2,}/g, "。")
    .replace(/[，、]\s*$/, "")
    .trim();
}

/**
 * 数字守卫：回答里的每个数字都必须能在工具返回里找到出处。
 *
 * 实测 1.7B 编过「可靠生活方式降低约 50% 风险」——这个 50% 谁都没给它。
 * 在健康类产品里这是最不能容忍的一类错误，所以整句删掉，
 * 而不是加一句「请自行核实」把责任推给用户。
 */
function guardNumbers(answer: string, observations: string[]): string {
  const allowed = new Set<string>();
  for (const o of observations) {
    for (const n of o.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(n);
  }

  // 按句号/分号/换行切句：模型偶尔输出不带标点的多行文本，
  // 只按标点切会整段当一句，一个坏数字连累整段被删。
  const sentences = answer
    .split(/(?<=[。！？；\n])/)
    .map((x) => x.trim())
    .filter(Boolean);
  const kept = sentences.filter((x) =>
    (x.match(/\d+(?:\.\d+)?/g) ?? []).every((n) => allowed.has(n)),
  );
  const out = kept.join("").trim();

  // 全被删掉说明这段话里的数字全无出处。此时不要硬凑，
  // 说清「没把握」，把判断留给界面上的结构化事实。
  return out.length > 0
    ? out
    : "这个问题的具体数字我没有可靠出处，就不写了——不编数字。你的个人风险可以看下面由规则引擎算出的结果。";
}

/** 观察结果截断，避免上下文被长文本挤爆（本地服务只有 4096）。 */
function clip(s: string, max = 420): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

// ---------------------------------------------------------------------------
// 决策
// ---------------------------------------------------------------------------

async function decide(
  question: string,
  steps: AgentStep[],
  forceFinal: boolean,
): Promise<Decision> {
  const history =
    steps.length === 0
      ? "（还没调用任何工具）"
      : steps
          .map(
            (s, i) =>
              `${i + 1}. 调用 ${s.action}${s.input ? `（${s.input}）` : ""}\n   观察：${clip(s.observation)}`,
          )
          .join("\n");

  const user = forceFinal
    ? `用户问题：${question}\n\n已执行：\n${history}\n\n步数已用完，请立即调用 final_answer 给出回答。`
    : `用户问题：${question}\n\n已执行：\n${history}\n\n请决定下一步。`;

  const res = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      grammar: AGENT_GBNF,
      max_tokens: 512,
      temperature: 0.2,
      cache_prompt: true,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!res.ok) {
    throw new Error(`推理服务返回 ${res.status}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";

  try {
    const parsed = JSON.parse(content) as Partial<Decision>;
    if (
      typeof parsed.action !== "string" ||
      typeof parsed.input !== "string" ||
      typeof parsed.thought !== "string"
    ) {
      throw new Error("字段缺失");
    }
    return {
      thought: parsed.thought,
      action: parsed.action as ToolName,
      input: parsed.input,
    };
  } catch {
    // 约束解码下不应发生；真发生了也要让上层能解释，而不是崩掉。
    throw new Error(`决策解析失败：${content.slice(0, 160)}`);
  }
}

/**
 * 把回答里的「依据：《标题》」补成带真实出处的形式。
 *
 * 为什么要补：知识库条目的标题（如《0–20 分和 0–26 分是两个版本》）看着像文献名，
 * 用户问「给我一篇论文」时只看到这个标题，等于拿到一个编造的出处。
 * 条目本身带 source 字段，这里把出处接上去，让每个"依据"都能核到真实来源。
 */
export function attachCitationSources(
  text: string,
  sources: Map<string, string>,
): string {
  return text.replace(/依据[：:]\s*《([^》]+)》/g, (whole, title: string) => {
    const src = sources.get(title);
    return src === undefined ? whole : `依据：《${title}》（出处：${src}）`;
  });
}

/**
 * 事实类问题：问的是知识库里的信息，而不是用户自己的数据。
 *
 * 用词表判定而不是让模型判断——这是"把知识递到模型面前"的确定性一步，
 * 判错的代价只是多检索一次（结果仍由模型决定用不用）。
 */
export function isFactualQuestion(question: string): boolean {
  // 问自己的风险/家系不算事实题（虽然也可能出现「多少」）
  if (/(我的|我是|我该|我需要|还剩|可回收)/.test(question)) return false;
  return /(满分|阈值|标准|区别|定义|含义|是什么|为什么|怎么算|怎么打分|分档|几档|档|级别|分级|评分|条目|分数|指的是|研究|文献|论文|出处|证据|试验|指南)/.test(
    question,
  );
}

/**
 * 药物与治疗类问题：可以解释风险，但不提供用药/治疗方案。
 *
 * 实测「吃二甲双胍能把风险降到多少」时，模型既没给药建议（安全），
 * 也没说"请咨询医生"，而是转向生活方式——用户读不出"这里不提供用药建议"。
 * 这是一句确定性护栏，不依赖模型自觉。
 */
export function withMedicalGuardrail(question: string, answer: string): string {
  const asksTreatment =
    /(药物|吃药|用药|服药|二甲双胍|胰岛素|他汀|剂量|处方|手术|治疗方案|怎么治|吃什么药)/.test(
      question,
    );
  if (!asksTreatment) return answer;
  if (/(医生|就医|专业|门诊)/.test(answer)) return answer;
  return (
    answer +
    "\n\n（用药与治疗方案需要医生结合你的具体情况判断，这里不提供用药建议。）"
  );
}

/**
 * 事实类问题但回答没有引用任何条目时，加一句中性的边界说明。
 *
 * 为什么用"没有引用"而不是"没检索到"：实测检索经常返回沾边但无关的条目
 * （问「大庆研究」命中了《吃降压药为什么会增加糖尿病风险分》），模型不引用它们，
 * 于是"检索为空"这条判据几乎不触发。用户看到的就是一段没有任何出处的断言。
 *
 * 文案必须中性：有时候答案是对的（如 FINDRISC 满分是 26），只是模型没写依据；
 * 所以说"这段没有引用知识库条目"，而不是"查不到"。
 */
/**
 * 去掉混进回答里的"内部指令"。
 *
 * 工具返回的观察值里带有给模型看的提示（如「（已检索到内容，请直接据此作答，不要换措辞重复检索。）」），
 * 1.7B 会把它连同条目正文一起抄进答案——实测公网问「FINDRISC 的满分是多少」就把它漏给了用户。
 * 这类字符串对用户没有意义，一律删掉。
 */
export function stripInternalHints(text: string): string {
  return text
    .replace(/（已检索到内容[^）]*）/g, "")
    .replace(/（这一步与之前完全相同[^）]*）/g, "")
    .replace(/（[a-z_]+ 本轮已调用[^）]*）/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function withNoSourceNotice(
  question: string,
  answer: string,
  citedTitles: string[],
): string {
  if (!isFactualQuestion(question)) return answer;
  if (citedTitles.length > 0) return answer;
  if (/没有引用|查不到|知识库/.test(answer)) return answer;
  return (
    answer +
    "\n\n（这段没有引用知识库条目。如果你需要可核对的出处，可以直接问「依据是什么」。）"
  );
}

/**
 * 依据是否与问题同题：条目自带的主题标签里，至少有一个出现在问题里。
 *
 * 标签是人工维护的（家族史/腰围/BMI/China-PAR…），比整句相似度稳定得多，
 * 也避免把「糖尿病」这种到处都有的词当成相关。
 */
export function isTagRelevant(question: string, tags: string[]): boolean {
  if (tags.length === 0) return false;
  // 去掉连字符与空格再比：用户会打「chinapar」，标签写的是「China-PAR」
  const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
  const q = norm(question);
  return tags.some((t) => {
    const tag = norm(t);
    return tag.length >= 2 && q.includes(tag);
  });
}

const MAX_STEPS = 4;

/**
 * 每个工具在一轮回答里的调用上限。
 *
 * 只靠「参数完全相同才去重」不够：模型会换措辞重复检索
 * （「为什么家族史重要」→「为什么家族史是重要依据」），
 * 结果同样是原地打转。按工具计次能从结构上堵住这条路。
 */
const CALL_CAP: Record<ToolName, number> = {
  summarize_pedigree: 1,
  compute_risk: 1,
  search_knowledge: 2,
  final_answer: Infinity,
};

/**
 * 跑一次 Agent。
 *
 * 步数上限 4 是算过的：一次完整回答通常是
 * summarize_pedigree → compute_risk → search_knowledge → final_answer，
 * 正好四步。留更多步数只会让 1.7B 反复调同一个工具。
 */
export async function runAgent(question: string, ctx: ToolContext): Promise<AgentResult> {
  const steps: AgentStep[] = [];
  /** 已经调过的「工具 + 参数」，用于识别原地打转。 */
  const seen = new Set<string>();
  /** 各工具已调用次数。 */
  const calls: Record<string, number> = {};
  /** 所有工具返回，供数字守卫核对出处。 */
  const observations: string[] = [];

  const facts: AgentFacts = { risk: null, pedigree: [], citations: [] };
  const allowedTitles = new Set<string>();
  /** 条目标题 → 出处；回答里的「依据：《标题》」会补上它 */
  const titleToSource = new Map<string, string>();
  let repeats = 0;

  /** 记录一次工具调用：观察值、结构化事实、可引用的标题。 */
  const record = (r: ReturnType<typeof runTool>) => {
    observations.push(r.observation);
    if (r.risk) facts.risk = r.risk;
    if (r.pedigree) facts.pedigree = r.pedigree;
    for (const c of r.citations ?? []) {
      // 只有"话题对得上"的条目才允许被引为依据。
      // 实测「光合作用是什么」拿到检索条目后，模型给它安了「依据：《FINDRISC 是什么》」——
      // 条目确实在检索结果里，但和问题毫无关系，这种"有依据的假象"比没依据更糟。
      if (!isTagRelevant(question, r.citationTags?.[c] ?? [])) continue;
      allowedTitles.add(c);
      const src = r.citationSources?.[c];
      if (src !== undefined) titleToSource.set(c, src);
      if (!facts.citations.includes(c)) facts.citations.push(c);
    }
  };

  // 事实类问题先检索，把条目直接摆在模型面前。
  //
  // 提示词里已经写了「问是什么/标准是多少要先 search_knowledge」，但 1.7B 经常不照做：
  // 实测「FINDRISC 满分是多少」直接拒答，「0–20 和 0–26 有什么区别」干脆答成用户个人风险。
  // 规则该做的是把知识递过去，而不是指望模型自觉——这一步是确定性的。
  if (isFactualQuestion(question)) {
    const r = runTool("search_knowledge", question, ctx);
    record(r);
    steps.push({
      thought: "这个问题问的是知识库里的内容，先检索条目",
      action: "search_knowledge",
      input: question,
      observation: r.observation,
    });
  }

  /**
   * 只保留回答里真正引用到的条目。
   *
   * 原来 facts.citations 是"检索到什么就显示什么"：实测「大庆研究能降低多少风险」
   * 检索出两条不相干条目（《吃降压药为什么会增加糖尿病风险分》《FINDRISC 是什么》），
   * 模型一条都没用，界面却把它们当成依据展示，比不显示更糟。
   */
  const onlyCited = (text: string): string[] =>
    facts.citations.filter((t) => text.includes(`《${t}》`));

  const finish = (raw: string): AgentResult => ({
    answer: withMedicalGuardrail(
      question,
      attachCitationSources(
        withNoSourceNotice(
          question,
          stripInternalHints(
            guardNumbers(cleanCitations(raw.trim(), allowedTitles), observations),
          ),
          onlyCited(raw),
        ),
        titleToSource,
      ),
    ),
    // 最终步的 input 是模型原始输出，可能带着编造的引用和数字；界面会把 steps
    // 渲染成"它怎么想的"，所以必须清空，不能让它绕过前面两道守卫。
    steps: steps.map((s) => (s.action === "final_answer" ? { ...s, input: "" } : s)),
    facts: { ...facts, citations: onlyCited(raw) },
  });

  for (let i = 0; i < MAX_STEPS; i++) {
    const d = await decide(question, steps, false);

    if (d.action === "final_answer") {
      steps.push({ ...d, observation: "" });
      return finish(d.input);
    }

    const key = `${d.action}|${d.input}`;
    if (seen.has(key)) {
      // 同一调用重复：不再执行（结果不会变），而是明确告诉它换路。
      // 1.7B 一旦认为「还没查够」就会反复调同一个工具，这是实测最典型的失控方式。
      repeats++;
      steps.push({
        ...d,
        observation:
          "（这一步与之前完全相同，已跳过。不要重复调用同一个工具：换一个工具，或直接调用 final_answer 回答。）",
      });
      if (repeats >= 2) break;
      continue;
    }

    const used = calls[d.action] ?? 0;
    if (used >= CALL_CAP[d.action]) {
      steps.push({
        ...d,
        observation: `（${d.action} 本轮已调用 ${used} 次，结果不会更多了。请换一个工具，或直接 final_answer 回答。）`,
      });
      continue;
    }

    seen.add(key);
    calls[d.action] = used + 1;

    const r = runTool(d.action, d.input, ctx);
    record(r);
    steps.push({ ...d, observation: r.observation });
  }

  // 步数用完还没收敛，逼它给一个回答，而不是把中间过程丢给用户
  const d = await decide(question, steps, true);

  // GBNF 只约束"四个 action 之一"，不保证模型真的收尾。
  // 若它仍返回工具调用，d.input 是检索词而不是结论 —— 直接当回答会输出一句
  // 「为什么要关心家族史」这种东西。这里只接受 final_answer，其余走确定性兜底。
  if (d.action === "final_answer" && d.input.trim().length > 0) {
    steps.push({ ...d, observation: "" });
    return finish(d.input);
  }

  steps.push({
    thought: "（步数已用完，模型仍未给出结论）",
    action: "final_answer",
    input: "",
    observation: "",
  });
  return finish(
    "这个问题我这次没能在限定步数内梳理出可靠结论。你可以换一种更具体的问法，或者直接看页面上的风险卡——那里的每个数字都标了出处。",
  );
}
