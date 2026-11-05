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
    : "这个问题的数字我没法可靠地组织成一句话，下面是从你的数据里直接算出来的结果。";
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
  let repeats = 0;

  const finish = (raw: string): AgentResult => ({
    answer: guardNumbers(cleanCitations(raw.trim(), allowedTitles), observations),
    steps,
    facts,
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
    observations.push(r.observation);
    if (r.risk) facts.risk = r.risk;
    if (r.pedigree) facts.pedigree = r.pedigree;
    if (r.citations) {
      for (const c of r.citations) {
        allowedTitles.add(c);
        if (!facts.citations.includes(c)) facts.citations.push(c);
      }
    }
    steps.push({ ...d, observation: r.observation });
  }

  // 步数用完还没收敛，逼它给一个回答，而不是把中间过程丢给用户
  const d = await decide(question, steps, true);
  steps.push({ ...d, observation: "" });
  return finish(d.input);
}
