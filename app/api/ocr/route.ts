import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/rate-limit";
import { mapLabItems, parseOcrJson } from "@/lib/ocr/parse";

/**
 * 化验单识别（拍照 → 结构化数值）。
 *
 * 隐私边界：图片只在内存里转成 base64 发给本机视觉模型，不落盘、不入库、不转发第三方。
 * 安全边界：这里只返回"候选数值"，写入体检数字必须由用户在前端逐项确认。
 */

export const runtime = "nodejs";

const VLM = process.env.VLM_SERVER_URL ?? "http://127.0.0.1:8082";
const PROMPT =
  "把这张化验单里的检验项目提取成 JSON 数组，不要解释。每个元素包含 name(项目名)、" +
  "value(结果数值，必须保留小数点)、unit(单位)、ref(参考范围)。只输出 JSON。";

async function vlmReady(): Promise<boolean> {
  try {
    const res = await fetch(VLM + "/v1/models", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 前端用这个决定要不要显示「上传化验单」入口：服务不在线就不显示，不留坏入口。 */
export async function GET() {
  return NextResponse.json({ ready: await vlmReady() });
}

export async function POST(request: Request) {
  // 视觉模型更贵：每 IP 每 10 分钟最多 12 次
  if (!allow(`ocr:${clientIp(request)}`, 12, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "识别请求过于频繁，请稍后再试" }, { status: 429 });
  }

  let body: { image?: unknown; mime?: unknown };
  try {
    body = (await request.json()) as { image?: unknown; mime?: unknown };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (image.length === 0) {
    return NextResponse.json({ error: "缺少 image 字段（base64）" }, { status: 400 });
  }
  // 8 MB 上限：手机直出照片通常在 2~4 MB，超过基本是误传
  if (image.length > 11_000_000) {
    return NextResponse.json({ error: "图片过大（上限约 8 MB）" }, { status: 413 });
  }
  const mime = body.mime === "image/jpeg" ? "image/jpeg" : "image/png";

  if (!(await vlmReady())) {
    return NextResponse.json(
      { error: "化验单识别服务未启动（需要本地视觉模型）" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(VLM + "/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "你是化验单结构化解析器，只输出 JSON，不要解释。数值必须保留原始小数点。",
          },
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:${mime};base64,${image}` } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 900,
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `识别服务返回 ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const items = parseOcrJson(raw);
    if (items.length === 0) {
      return NextResponse.json(
        { error: "没能从这张图里读出检验项目，换一张更清晰的照片试试" },
        { status: 422 },
      );
    }
    const { fields, unused } = mapLabItems(items);
    return NextResponse.json({ items, fields, unused });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message.includes("timeout") ? "识别超时" : "识别失败" },
      { status: 504 },
    );
  }
}
