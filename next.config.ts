import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 通过 clear.ysti.com.cn 的 SSH 反向隧道访问 dev server 时，
  // Host 头与本地不一致，需显式放行，否则会被 Next 的跨源保护拦下。
  allowedDevOrigins: ["clear.ysti.com.cn", "127.0.0.1", "localhost"],
  // 关掉开发期的浮层指示器，截图 / 演示时画面干净
  devIndicators: false,
};

export default nextConfig;
