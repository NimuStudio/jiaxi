import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

/** 查询当前登录用户。前端启动时调用一次，决定显示「登录」还是用户名。 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    return NextResponse.json({ user });
  } catch (error) {
    // 数据库不可用时不阻塞页面：按未登录处理
    console.error("[auth/me] 失败：", error);
    return NextResponse.json({ user: null });
  }
}
