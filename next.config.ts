import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 通过 clear.ysti.com.cn 的 SSH 反向隧道访问 dev server 时，
  // Host 头与本地不一致，需显式放行，否则会被 Next 的跨源保护拦下。
  allowedDevOrigins: ["clear.ysti.com.cn", "127.0.0.1", "localhost"],

  // 关掉开发期的浮层指示器，截图 / 演示时画面干净
  devIndicators: false,
};

export default nextConfig;

/**
 * 部署方式说明（为什么不用 output: "standalone"）
 *
 * 评审用的 VPS 只有 1.6G 内存，在上面跑 `next build` 会 OOM，
 * 所以构建在本地做，只上传 `.next` 产物，服务器上执行：
 *
 *   pnpm install --prod --frozen-lockfile && next start
 *
 * 曾经试过 standalone 产物，但本项目用 pnpm 安装依赖，standalone 里的
 * node_modules 是一堆指向 `.pnpm/...` 的**绝对路径软链**。
 * 把软链解引用成实体目录后，pnpm 的嵌套解析结构被破坏——
 * `next` 找不到自己 `@swc/helpers`，服务起不来；
 * 保留软链则路径是 Windows 的 `/d/develop/...`，在 Linux 上无效。
 * 所以改为「上传 .next + 服务器装依赖」，这是跨平台最稳的做法。
 */
