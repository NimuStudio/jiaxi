import "server-only";

/**
 * 极简滑动窗口限流（进程内）。
 *
 * 本项目是单机部署（本机 Next + 本机模型），进程内计数就够挡住在线爆破与
 * 匿名刷模型推理；多实例部署时需要换成 Redis 之类的共享存储。
 */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

function ipOf(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * 返回 true 表示放行；false 表示已超限。
 * @param key    限流维度（如 "login:demo"）
 * @param limit  窗口内允许的次数
 * @param windowMs 窗口长度
 */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);

  // 顺手清理过期桶，避免长期运行后 Map 无限增长
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return true;
}

export function clientIp(request: Request): string {
  return ipOf(request);
}
