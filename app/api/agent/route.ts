import { NextResponse } from "next/server";
import kbData from "../../../data/kb/findrisc-kb.json";
import { runAgent } from "@/lib/agent/loop";
import type { RiskFactors } from "@/lib/agent/tools";
import { parseRiskFactors } from "@/lib/risk/factors-validate";
import { isLlmReady } from "@/lib/extract/client";
import type { KnowledgeEntry } from "@/lib/rag/search";
import type { ExtractedPerson } from "@/lib/extract/client";

/**
 * 家系问答（Agent）
 *
 * 与 /api/extract 的区别：
 *   extract 是一条固定流水线，输入一句话、输出节点；
 *   这里是模型自己决定调哪个工具、调几次、什么时候能回答。
 *
 * 工具的执行全在服务端，模型只负责「决策」，拿不到也改不了数据。
 */

export const runtime = "nodejs";

const KB = kbData as KnowledgeEntry[];

interface AgentBody {
  question?: unknown;
  persons?: unknown;
  factors?: unknown;
}

/** 只信任结构正确的输入，避免把脏数据喂给工具。 */
function parsePersons(v: unknown): ExtractedPerson[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p): ExtractedPerson => ({
      relation: String(p.relation ?? "unknown"),
      sex:
        p.sex === "male" || p.sex === "female"
          ? p.sex
          : ("unknown" as const),
      conditions: Array.isArray(p.conditions)
        ? p.conditions
            .filter(
              (c): c is Record<string, unknown> =>
                typeof c === "object" && c !== null,
            )
            .map((c) => ({
              code: String(c.code ?? ""),
              onsetAge:
                typeof c.onsetAge === "number" ? c.onsetAge : null,
            }))
            .filter((c) => c.code.length > 0)
        : [],
    }))
    .filter((p) => p.conditions.length > 0);
}

// 体检数字统一走共享校验（含生理值域）：原来这里的 Boolean(x) 会把「字段缺失」
// 静默变成 false，等于替用户回答「不运动、不吃蔬菜、有高血压」，直接加分。
const parseFactors = (v: unknown): RiskFactors | null => parseRiskFactors(v);

export async function POST(request: Request) {
  let body: AgentBody;
  try {
    body = (await request.json()) as AgentBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length === 0) {
    return NextResponse.json({ error: "缺少 question 字段" }, { status: 400 });
  }
  if (question.length > 200) {
    return NextResponse.json({ error: "问题过长（上限 200 字）" }, { status: 400 });
  }

  if (!(await isLlmReady())) {
    return NextResponse.json(
      {
        error:
          "AI 服务当前未连接（模型运行在演示机上，仅在评审时段在线）。家系图、风险量化与依据检索不受影响。",
      },
      { status: 503 },
    );
  }

  // 评测开关：noKb=1 时不给知识库，用于量化「检索增强到底提升了多少」。
  // 只影响本请求，产品默认行为不变（前端不传这个参数）。
  const noKb = new URL(request.url).searchParams.get("noKb") === "1";

  try {
    const result = await runAgent(question, {
      persons: parsePersons(body.persons),
      factors: parseFactors(body.factors),
      kb: noKb ? [] : KB,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[agent] 执行失败：", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** 供前端探测推理服务是否在线。 */
export async function GET() {
  return NextResponse.json({ ready: await isLlmReady() });
}
