/**
 * 量首屏体积：抓页面 HTML，把里面引用的 JS/CSS 全下载一遍，统计未压缩与 gzip 后的大小。
 *
 * 为什么不用 next build 的表格：新版本 Turbopack 的输出里没有每路由体积，
 * 而「用户到底下载了多少」才是性能优化的目标。
 *
 * 注意：Node 的 fetch 会自动解压，所以拿到的永远是未压缩字节；
 * 这里用 zlib 在本地算一个 gzip 近似值，label 上写清是估算。
 *
 * 跑法：node scripts/measure-first-load.mjs [baseUrl]   （需站点在运行）
 */
import { gzipSync } from 'node:zlib'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173'
const ROUTES = ['/', '/chat', '/cvd']

async function bytesOf(url) {
  const res = await fetch(url)
  if (!res.ok) return { raw: 0, gz: 0 }
  const buf = Buffer.from(await res.arrayBuffer())
  return { raw: buf.byteLength, gz: gzipSync(buf).byteLength }
}

console.log('路由    资源   未压缩       gzip 估算')
for (const route of ROUTES) {
  const html = await (await fetch(BASE + route)).text()
  const assets = new Set()
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) assets.add(m[1])
  for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)) assets.add(m[1])
  let raw = 0
  let gz = 0
  for (const a of assets) {
    const s = await bytesOf(new URL(a, BASE).toString())
    raw += s.raw
    gz += s.gz
  }
  console.log(`${route.padEnd(7)} ${String(assets.size).padStart(2)} 个  ${(raw / 1024).toFixed(1).padStart(8)} KB  ${(gz / 1024).toFixed(1).padStart(8)} KB`)
}

export {}
