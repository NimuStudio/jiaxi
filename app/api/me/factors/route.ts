import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseRiskFactors } from "@/lib/risk/factors-validate";

/**
 * 体检数字云端存取（登录用户，一人一份 JSON）。
 *
 * 三种读取结果必须可区分（以前「没有记录」和「记录坏了」都返回 null，
 * 客户端见到空值就用本地副本回写，等于把云端数据静默覆盖）：
 *  - 没有记录   → 200 { factors: null, state: "empty" }
 *  - 记录损坏   → 500（服务端日志带 user_id），客户端禁止回写
 *  - 正常       → 200 { factors, state: "ok" }
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const pool = await db();
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT factors FROM risk_factors WHERE user_id = ?",
      [user.id],
    );
    const row = rows[0] as { factors: unknown } | undefined;
    if (!row) return NextResponse.json({ factors: null, state: "empty" });

    const parsed = parseRiskFactors(row.factors);
    if (!parsed) {
      console.error("[me/factors] 云端记录不符合当前结构", { userId: user.id });
      return NextResponse.json({ error: "云端记录损坏，请勿用本地副本覆盖" }, { status: 500 });
    }
    return NextResponse.json({ factors: parsed, state: "ok" });
  } catch (error) {
    console.error("[me/factors] 读取失败", error);
    return NextResponse.json({ error: "数据库暂时不可用" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { factors?: unknown };
  try {
    body = (await request.json()) as { factors?: unknown };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const factors = parseRiskFactors(body.factors);
  if (factors === null) {
    return NextResponse.json(
      { error: "体检数字格式不合法（年龄 18-120、BMI 10-60、腰围 40-200 厘米）" },
      { status: 400 },
    );
  }

  try {
    const pool = await db();
    await pool.query(
      `INSERT INTO risk_factors (user_id, factors) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE factors = VALUES(factors)`,
      [user.id, JSON.stringify(factors)],
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[me/factors] 写入失败", error);
    return NextResponse.json({ error: "数据库暂时不可用" }, { status: 500 });
  }
}
