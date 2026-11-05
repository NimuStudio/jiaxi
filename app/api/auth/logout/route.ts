import { NextResponse } from "next/server";
import { currentUser, destroySession, clearSessionCookie } from "@/lib/auth";

/** 登出：删除服务端会话行 + 清 cookie。 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/pedigree_session=([0-9a-f]{64})/);
  try {
    await destroySession(match?.[1]);
  } catch (error) {
    // 删不掉行也不要紧：cookie 已被清掉，客户端侧即刻登出
    console.error("[auth/logout] 清理会话失败：", error);
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
}

/** 顺手暴露当前用户给前端轮询（未登录返回 401，前端据此显示登录态）。 */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
