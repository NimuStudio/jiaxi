/**
 * 认证与会话（MySQL 存储）。
 *
 * 设计选择：
 *  - 密码哈希用 node:crypto 的 scrypt（内置、无需原生编译、抗 GPU）。
 *    每个用户独立随机盐，存储格式 `scrypt$N$salt$hash`（盐十六进制）。
 *  - 会话是服务端表（sessions）：cookie 里只放随机 token（httpOnly +
 *    SameSite=Lax + Secure），登出删行即失效；过期行由清理逻辑顺带删除。
 *  - token 用 32 字节随机数（64 个十六进制字符），与表主键对齐。
 *
 * 为什么不用 JWT：服务端会话表能即时吊销（登出、改密），
 * 演示评审里「点登出立刻失效」比「等 token 自然过期」更好讲。
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

const SCRYPT_N = 16384; // 成本参数：登录演示机上一二百毫秒，够防离线爆破
const SESSION_DAYS = 30;

export interface SessionUser {
  id: number;
  username: string;
}

/* ---------- 密码哈希 ---------- */

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16);
    scrypt(password, salt, 64, { N: SCRYPT_N }, (err, derived) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT_N}$${salt.toString("hex")}$${derived.toString("hex")}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = stored.split("$");
    if (parts.length !== 4 || parts[0] !== "scrypt") return resolve(false);
    const N = Number(parts[1]);
    const salt = Buffer.from(parts[2] ?? "", "hex");
    const expected = Buffer.from(parts[3] ?? "", "hex");
    scrypt(password, salt, expected.length, { N }, (err, derived) => {
      if (err) return resolve(false);
      resolve(derived.length === expected.length && timingSafeEqual(derived, expected));
    });
  });
}

/* ---------- 用户 ---------- */

export function validateUsername(name: unknown): name is string {
  return typeof name === "string" && /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,32}$/.test(name);
}

export function validatePassword(pwd: unknown): pwd is string {
  // 长度下限 6：演示应用不逼用户设复杂密码，但明文短口令也不放行
  return typeof pwd === "string" && pwd.length >= 6 && pwd.length <= 72;
}

export async function createUser(
  username: string,
  password: string,
): Promise<SessionUser | "duplicate"> {
  const pool = await db();
  const hash = await hashPassword(password);
  try {
    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, hash],
    );
    const insertId = (result as { insertId: number }).insertId;
    return { id: insertId, username };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") return "duplicate";
    throw err;
  }
}

export async function findUser(username: string): Promise<
  { id: number; username: string; passwordHash: string } | null
> {
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?",
    [username],
  );
  const row = rows[0] as { id: number; username: string; passwordHash: string } | undefined;
  return row ? { id: row.id, username: row.username, passwordHash: row.passwordHash } : null;
}

/* ---------- 会话 ---------- */

export const SESSION_COOKIE = "pedigree_session";

export async function createSession(userId: number): Promise<string> {
  const pool = await db();
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))",
    [token, userId, SESSION_DAYS],
  );
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const pool = await db();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.username FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()`,
    [token],
  );
  const row = rows[0] as { id: number; username: string } | undefined;
  return row ? { id: row.id, username: row.username } : null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const pool = await db();
  await pool.query("DELETE FROM sessions WHERE token = ?", [token]);
}

/**
 * 读取请求里的当前用户。
 * API 路由统一入口：从 cookie 拿 token → 查会话。
 * 顺带做轻量清理：登录/校验时删除已过期会话（懒回收，免额外定时任务）。
 */
export async function currentUser(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\s*)${SESSION_COOKIE}=([0-9a-f]{64})`));
  const user = await getSessionUser(match?.[1]);
  if (user) {
    const pool = await db();
    void pool.query("DELETE FROM sessions WHERE expires_at <= NOW()").catch(() => {});
  }
  return user;
}

/** 写会话 cookie 的响应头片段。secure 由调用方按请求协议决定。 */
export function sessionCookie(token: string, secure: boolean, maxAgeDays = SESSION_DAYS): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeDays * 86400}`,
  ];
  // 只有 https 访问才加 Secure；本地 http 调试加了会被浏览器拒收
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

/** 请求是否经由 https 到达（nginx 反代会带 X-Forwarded-Proto）。 */
export function isHttps(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** 清除会话 cookie 的响应头片段。 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
