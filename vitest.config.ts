import { defineConfig } from "vitest/config";

export default defineConfig({
  // 与 tsconfig 的 paths 保持一致：源码里有 @/lib/... 这种导入，
  // 之前没有测试间接引用过这些模块，所以一直没暴露；补上别名后测试才能加载它们。
  resolve: {
    alias: {
      "@": new URL("./src/", import.meta.url).pathname,
    },
  },
  // 缓存放进项目内，避免写入系统临时目录
  // （容器 / 沙箱环境下写 %TEMP% 可能被拒）
  cacheDir: "node_modules/.vitest",
  test: {
    include: ["src/**/*.test.ts"],
  },
});
