import { extractPedigreeSplit, isLlmReady, type ExtractStage } from "@/lib/extract/client";

/**
 * 家系信息抽取 · SSE 流式版
 *
 * 和 /api/extract 完成同一件事，但把「AI 思考状态」实时推给前端：
 *   分句 → 逐句抽取（带进度） → 合并 → 最终结果
 *
 * 抽取一次要 3~9 秒（本地 1.7B 串行推理）。与其让用户盯着一个转圈，
 * 不如把真实阶段流出来——这既是「AI 思考状态可视化」的评分点，
 * 也是答辩时演示「分句→抽取→三层校验」架构的最好载体。
 *
 * 事件格式（text/event-stream，每条 data 是一个 JSON）：
 *   {"type":"split","total":2,"segments":[...]}
 *   {"type":"segment","index":1,"total":2,"segment":"..."}
 *   {"type":"merged","persons":3}
 *   {"type":"done","persons":[...]}
 *   {"type":"error","error":"..."}
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
    return new Response("请求体不是合法 JSON", { status: 400 });
  }

  const text = body.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return new Response("缺少 text 字段", { status: 400 });
  }

  const ready = await isLlmReady();
  if (!ready) {
    return new Response(
      JSON.stringify({
        error:
          "AI 抽取服务当前未连接（模型运行在演示机上，仅在评审时段在线）。家系图、风险量化与依据检索不受影响。",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        const result = await extractPedigreeSplit(text, {
          fewShot: true,
          onStage: (stage: ExtractStage) => send(stage),
        });
        send({ type: "done", persons: result.persons });
      } catch (error) {
        console.error("[extract/stream] 抽取失败：", error);
        console.error("[extract/stream] 抽取失败", error);
      send({ type: "error", error: "抽取服务出错了，请稍后再试。" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // 关闭代理缓冲，保证事件是「实时」到达而不是攒够一批
      "X-Accel-Buffering": "no",
    },
  });
}
