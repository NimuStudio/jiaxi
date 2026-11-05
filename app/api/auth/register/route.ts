import { NextResponse } from "next/server";
import {
  createUser,
  validateUsername,
  validatePassword,
  createSession,
  sessionCookie,
  isHttps,
} from "@/lib/auth";

/**
 * 注册：用户名 + 密码 → 创建用户并直接登录（注册成功即建立会话）。
 * 用户名规则：2-32 位，字母/数字/下划线/中文；密码 6-72 位。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RegisterBody {
  username?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { username, password } = body;
  if (!validateUsername(username)) {
    return NextResponse.json(
      { error: "用户名需 2-32 位，可用字母、数字、下划线或中文" },
      { status: 400 },
    );
  }
  if (!validatePassword(password)) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }

  try {
    const created = await createUser(username, password);
    if (created === "duplicate") {
      return NextResponse.json({ error: "这个用户名已经被注册了" }, { status: 409 });
    }
    const token = await createSession(created.id);
    return NextResponse.json(
      { user: { id: created.id, username: created.username } },
      {
        status: 201,
        headers: { "Set-Cookie": sessionCookie(token, isHttps(request)) },
      },
    );
  } catch (error) {
    console.error("[auth/register] 失败：", error);
    return NextResponse.json({ error: "数据库暂时不可用，请稍后再试" }, { status: 500 });
  }
}
