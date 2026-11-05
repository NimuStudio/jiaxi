/**
 * MySQL 数据层（mysql2 连接池）。
 *
 * 为什么用数据库而不是 localStorage：家系和体检数字是个人健康数据，
 * 用户换浏览器/换机器时应该能找回；同时也支持后续多设备同步与导出。
 * 隐私边界不变——数据库与站点、模型跑在同一台机器上，数据不出机器。
 *
 * 连接参数来自环境变量（.env.local，已 gitignore）：
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
 *
 * 表结构在启动时用 CREATE TABLE IF NOT EXISTS 幂等创建（ensureSchema），
 * 应用账号只有 pedigree 库的权限，无法触碰系统库。
 */

import mysql from "mysql2/promise";

export const DB_CONFIG = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "pedigree_app",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "pedigree",
  waitForConnections: true,
  connectionLimit: 8,
  /** 家系/体检数字是低频写入，闲置连接快速回收，别占着演示机内存 */
  idleTimeout: 60_000,
  charset: "utf8mb4",
};

const pool = mysql.createPool(DB_CONFIG);

let schemaReady: Promise<void> | null = null;

/**
 * 幂等建表。进程生命周期内只跑一次（成功后缓存 Promise）。
 *
 * 表设计说明：
 *  - users：用户名 + scrypt 哈希（不存明文）。用户名唯一。
 *    演示场景不需要邮箱验证，用户名即身份。
 *  - sessions：服务端会话表（httpOnly cookie 只存随机 token），
 *    支持登出即失效、过期自动清理。
 *  - pedigrees / risk_factors：一人一份，JSON 存整份结构化数据。
 *    家系结构是树形/任意图，且字段随功能演化，关系表反而僵硬；
 *    JSON 文档 + 应用层校验足够，还能与服务端 API 版本解耦。
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
          username VARCHAR(32) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          token CHAR(64) PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          INDEX idx_sessions_user (user_id),
          INDEX idx_sessions_expires (expires_at),
          CONSTRAINT fk_sessions_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pedigrees (
          user_id BIGINT UNSIGNED PRIMARY KEY,
          persons JSON NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_pedigrees_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS risk_factors (
          user_id BIGINT UNSIGNED PRIMARY KEY,
          factors JSON NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_factors_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((err) => {
      // 失败不缓存：下次请求重试建表（比如 MySQL 姗姗来迟地启动了）
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/** 给 API 路由用的统一入口：建表 + 拿连接池。 */
export async function db() {
  await ensureSchema();
  return pool;
}

/** 进程退出时优雅关闭（Windows 上 next dev 热重载会反复重启进程）。 */
process.on("exit", () => {
  void pool.end().catch(() => {});
});
