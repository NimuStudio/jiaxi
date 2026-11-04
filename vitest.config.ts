import { defineConfig } from "vitest/config";

export default defineConfig({
  // 缓存放进项目内，避免写入系统临时目录
  // （容器 / 沙箱环境下写 %TEMP% 可能被拒）
  cacheDir: "node_modules/.vitest",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
