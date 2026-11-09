import { NextResponse } from "next/server";
import type { ExtractedPerson } from "@/lib/extract/client";
import { decideHereditary } from "@/lib/decision/hereditary";

/**
 * 遗传模式判定（typed decision model）
 *
 * 走 llama.cpp 的 /v1/systemone：一次前向在五个模式上给概率，不生成文本。
 * 服务端没配决策模型（DECISION_SERVER_URL 为空、或该模型不是决策模型）时，
 * 照常返回 200，只是 source=rules 且 mode=insufficient —— 判不了就说判不了，
 * 不要因为「接口挂了」变成 500 让前端显示成错误。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 防滥用：persons 只接受有限条数与有限字段 */
function sanitize(input: unknown): ExtractedPerson[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 40) return null;
  const out: ExtractedPerson[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.relation !== "string" || p.relation.length > 40) return null;
    const sex = p.sex === "male" || p.sex === "female" ? p.sex : "unknown";
    const conditions = Array.isArray(p.conditions) ? p.conditions : [];
    if (conditions.length > 20) return null;
    const cleaned = [];
    for (const c of conditions) {
      if (!c || typeof c !== "object") continue;
      const item = c as Record<string, unknown>;
      if (typeof item.code !== "string" || item.code.length > 60) continue;
      const age = typeof item.onsetAge === "number" ? item.onsetAge : null;
      cleaned.push({ code: item.code, onsetAge: age });
    }
    out.push({ relation: p.relation, sex, conditions: cleaned });
  }
  return out;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const persons = sanitize((body as { persons?: unknown } | null)?.persons);
  if (!persons) {
    return NextResponse.json({ error: "persons 缺失或超出范围" }, { status: 400 });
  }

  const decision = await decideHereditary(persons);
  return NextResponse.json(decision);
}
