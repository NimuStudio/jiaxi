#!/usr/bin/env node
/**
 * 创建/重置一个应用账号（评审账号、团队成员账号用）。
 *
 * 用法：
 *   node scripts/create-user.mjs <用户名> <密码>
 *
 * 密码哈希与 src/lib/auth.ts 完全一致：scrypt$N$salt$hash（N=16384，16 字节随机盐，64 字节派生）。
 * 连接参数取自环境变量（MYSQL_*），因此在项目根目录、带 .env.local 时直接可用。
 */
import { randomBytes, scrypt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import mysql from 'mysql2/promise'

const SCRYPT_N = 16384

// Next.js 会自动读 .env.local；这里是独立脚本，手动补上（已存在环境变量优先）
try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch { /* 没有 .env.local 就用默认值 */ }

const [username, password] = process.argv.slice(2)
if (!username || !password) {
  console.error('用法: node scripts/create-user.mjs <用户名> <密码>')
  process.exit(1)
}
if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{2,32}$/.test(username)) {
  console.error('用户名只能包含中英文、数字、下划线，长度 2-32')
  process.exit(1)
}
if (password.length < 6) {
  console.error('密码至少 6 位')
  process.exit(1)
}

function hashPassword(pwd) {
  const salt = randomBytes(16)
  return new Promise((resolve, reject) => {
    scrypt(pwd, salt, 64, { N: SCRYPT_N }, (err, derived) => {
      if (err) reject(err)
      else resolve(`scrypt$${SCRYPT_N}$${salt.toString('hex')}$${derived.toString('hex')}`)
    })
  })
}

const conn = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'pedigree_app',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'pedigree',
  charset: 'utf8mb4',
})
try {
  const hash = await hashPassword(password)
  await conn.execute('CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(32) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
  const [res] = await conn.execute(
    'INSERT INTO users (username, password_hash) VALUES (?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)',
    [username, hash],
  )
  console.log(`已写入账号: ${username}（${res.affectedRows === 2 ? '已存在，密码已重置' : '新建'}）`)
} finally {
  await conn.end()
}