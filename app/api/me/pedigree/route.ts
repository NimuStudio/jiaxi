import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ExtractedPerson } from "@/lib/extract/client";

/**
 * 家系云端存取（登录用户，一人一份）。
 *
 * GET  ：返回 { persons } 或 401。
 * PUT  ：整份覆盖保存。为什么整份覆盖而不是增量：
 *        前端本来就持有全量（图渲染需要），增量协议只会引入
 *        「两端各自改了一半」的一致性问题。冲突以最后写入为准，
 *        对单人单设备的真实使用方式足够。
 *
 * 内容校验：persons 必须是数组、每项有 relation/sex/conditions 字段，
 * 拒绝存明显畸形的数据（防止 XSS 型 payload 进库后原样发回其他端）。
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizePersons(input: unknown): ExtractedPerson[] | null {
  if (!Array.isArray(input)) return null;
  const out: ExtractedPerson[] = [];
  for (const p of input) {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    if (typeof r.relation !== "string" || r.relation.length > 64) return null;
    if (r.sex !== "male" && r.sex !== "female" && r.sex !== "unknown") return null;
    if (!Array.isArray(r.conditions)) return null;
    const conds = [];
    for (const c of r.conditions) {
      if (typeof c !== "object" || c === null) return null;
      const cc = c as Record<string, unknown>;
      if (typeof cc.code !== "string" || cc.code.length > 64) return null;
      const age = cc.onsetAge;
      if (age !== null && typeof age !== "number") return null;
      conds.push({ code: cc.code, onsetAge: age });
    }
    out.push({ relation: r.relation, sex: r.sex, conditions: conds });
  }
  return out;
}

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT persons FROM pedigrees WHERE user_id = ?",
    [user.id],
  );
  const row = rows[0] as { persons: unknown } | undefined;
  const persons = row ? sanitizePersons(row.persons) : [];
  return NextResponse.json({ persons: persons ?? [] });
}

export async function PUT(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { persons?: unknown };
  try {
    body = (await request.json()) as { persons?: unknown };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const persons = sanitizePersons(body.persons);
  if (persons === null) {
    return NextResponse.json({ error: "家系数据格式不合法" }, { status: 400 });
  }

  const pool = await db();
  await pool.query(
    `INSERT INTO pedigrees (user_id, persons) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE persons = VALUES(persons)`,
    [user.id, JSON.stringify(persons)],
  );
  return NextResponse.json({ ok: true, count: persons.length });
}
