import { NextResponse } from "next/server";
import {
  findUser,
  verifyPassword,
  createSession,
  validateUsername,
  sessionCookie,
  isHttps,
} from "@/lib/auth";

/**
 * 登录：验证用户名密码，建立会话。
 * 统一返回「用户名或密码不对」——不区分哪个错了，避免枚举用户名。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LoginBody {
  username?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { username, password } = body;
  if (!validateUsername(username) || typeof password !== "string") {
    return NextResponse.json({ error: "用户名或密码不对" }, { status: 401 });
  }

  try {
    const user = await findUser(username);
    // 未注册时也做一次哈希运算（恒定时间），不给「该用户不存在」的时序信号
    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, "scrypt$16384$00$00");
    if (!user || !ok) {
      return NextResponse.json({ error: "用户名或密码不对" }, { status: 401 });
    }

    const token = await createSession(user.id);
    return NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { headers: { "Set-Cookie": sessionCookie(token, isHttps(request)) } },
    );
  } catch (error) {
    console.error("[auth/login] 失败：", error);
    return NextResponse.json({ error: "数据库暂时不可用，请稍后再试" }, { status: 500 });
  }
}
