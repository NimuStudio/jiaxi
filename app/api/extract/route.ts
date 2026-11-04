import { NextResponse } from "next/server";
import { extractPedigreeSplit, isLlmReady } from "@/lib/extract/client";

/**
 * 家系信息抽取接口
 *
 * 浏览器 → 这里 → 本机 llama-server(8080) → GGUF 模型
 * 全程不出本机：家族病史属敏感信息，这也是选择本地推理而非云 API 的主要原因。
 */

export const runtime = "nodejs";

interface ExtractBody {
  text?: unknown;
}

export async function POST(request: Request) {
  let body: ExtractBody;
  try {
    body = (await request.json()) as ExtractBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const text = body.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "缺少 text 字段" }, { status: 400 });
  }

  const ready = await isLlmReady();
  if (!ready) {
    return NextResponse.json(
      {
        error:
          "本地推理服务未启动。请在 llama.cpp 目录运行 llama-server 并加载模型（默认 127.0.0.1:8080）。",
      },
      { status: 503 },
    );
  }

  try {
    // 分句抽取：长句里多个人时，逐句处理比一次抽全更稳。
    const result = await extractPedigreeSplit(text, { fewShot: true });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[extract] 抽取失败：", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

/** 供前端探测推理服务是否在线。 */
export async function GET() {
  const ready = await isLlmReady();
  return NextResponse.json({ ready });
}
