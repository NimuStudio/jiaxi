import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * 体检数字云端存取（登录用户，一人一份 JSON）。
 *
 * 与家系同一套「整份覆盖」协议。校验只放行与 RiskFactors 结构
 * 一致的字段：数字字段必须是有限正数，布尔字段必须是布尔。
 * NULL 表示「没有保存过」，与前端 RiskFactors | null 对齐。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FactorsShape {
  age: number;
  sex: "male" | "female";
  bmi: number;
  waistCm: number;
  physicallyActive: boolean;
  eatsVegetablesDaily: boolean;
  onAntihypertensive: boolean;
  historyOfHighGlucose: boolean;
  smoker: boolean;
  drinker: boolean;
}

function posNum(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function sanitizeFactors(input: unknown): FactorsShape | null {
  if (typeof input !== "object" || input === null) return null;
  const f = input as Record<string, unknown>;
  if (!posNum(f.age) || !posNum(f.bmi) || !posNum(f.waistCm)) return null;
  if (f.sex !== "male" && f.sex !== "female") return null;
  for (const k of [
    "physicallyActive",
    "eatsVegetablesDaily",
    "onAntihypertensive",
    "historyOfHighGlucose",
  ] as const) {
    if (typeof f[k] !== "boolean") return null;
  }
  // 生活方式暴露是后来加的：老数据没有这两项，缺省按 false 处理，不当作非法输入
  const exposure = (v: unknown) => (typeof v === "boolean" ? v : false);
  return {
    age: f.age as number,
    sex: f.sex,
    bmi: f.bmi as number,
    waistCm: f.waistCm as number,
    physicallyActive: f.physicallyActive as boolean,
    eatsVegetablesDaily: f.eatsVegetablesDaily as boolean,
    onAntihypertensive: f.onAntihypertensive as boolean,
    historyOfHighGlucose: f.historyOfHighGlucose as boolean,
    smoker: exposure(f.smoker),
    drinker: exposure(f.drinker),
  };
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT factors FROM risk_factors WHERE user_id = ?",
    [user.id],
  );
  const row = rows[0] as { factors: unknown } | undefined;
  return NextResponse.json({ factors: row ? sanitizeFactors(row.factors) : null });
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

  const factors = sanitizeFactors(body.factors);
  if (factors === null) {
    return NextResponse.json({ error: "体检数字格式不合法" }, { status: 400 });
  }

  const pool = await db();
  await pool.query(
    `INSERT INTO risk_factors (user_id, factors) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE factors = VALUES(factors)`,
    [user.id, JSON.stringify(factors)],
  );
  return NextResponse.json({ ok: true });
}
