import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/rate-limit";
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
  // 模型接口不需要登录，但必须限流：否则匿名调用方可以反复触发本机推理
  if (!allow(`extract:${clientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

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
  // 长度上限：本机 1.7B 模型跑 2000 字要几十秒，不设上限就是给匿名调用方
  // 一把把 GPU 占满的钥匙（实测 800 句直接把请求拖到超时）。
  if (text.length > 2000) {
    return NextResponse.json({ error: "一次最多 2000 字，请分段说" }, { status: 400 });
  }

  const ready = await isLlmReady();
  if (!ready) {
    return NextResponse.json(
      {
        // 这句话会显示在聊天区，读者可能是评委而不是开发者，
        // 所以要说清「发生了什么、还能用什么」，而不是给出启动命令。
        error:
          "AI 抽取服务当前未连接（模型运行在演示机上，仅在评审时段在线）。家系图、风险量化与依据检索不受影响；也可以先看示例家系。",
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
      { error: "抽取服务出错了，请稍后再试。" },
      { status: 500 },
    );
  }
}

/** 供前端探测推理服务是否在线。 */
export async function GET() {
  const ready = await isLlmReady();
  return NextResponse.json({ ready });
}
