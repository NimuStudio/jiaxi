import { NextResponse } from "next/server";
import kbData from "../../../data/kb/findrisc-kb.json";
import { searchKnowledge, type KnowledgeEntry } from "@/lib/rag/search";

/**
 * 依据检索
 *
 * 语料全部来自 docs/references.md 中已核实的内容，
 * 每条都带出处，检索不到就返回空——不生成、不推测。
 */

const KB = kbData as KnowledgeEntry[];

export async function POST(request: Request) {
  let query = "";
  try {
    const body = (await request.json()) as { query?: unknown };
    if (typeof body.query === "string") query = body.query;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (query.trim().length === 0) {
    return NextResponse.json({ error: "缺少 query" }, { status: 400 });
  }

  const results = searchKnowledge(query, KB, 3);
  return NextResponse.json({
    query,
    results,
    // 检索不到时明确说明，而不是编一条出来
    found: results.length > 0,
  });
}

export async function GET() {
  return NextResponse.json({ size: KB.length });
}
