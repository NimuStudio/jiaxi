# 首屏性能实测（2026-11-05）

## 结论

- 业务代码很薄：所有组件加起来只有几十 KB 源码，/、/chat、/cvd 三个页面各自引入的
  业务 chunk 都很小；首屏体积由 **React 19 + Next 16 运行时**主导，这部分拆不动。
- 因此**没有做懒加载**：把 5 KB 的组件改成 dynamic import，只会多一个加载态和一处复杂度，
  收益低于测量噪声。这是有意不做，不是漏做。
- 真正的瓶颈在部署链路：**公网 nginx 没有给静态资源压缩**。

## 实测数字

| 指标 | 数值 |
| --- | --- |
| 首屏资源（未压缩，/、/chat、/cvd） | 625.1 / 648.3 / 627.3 KB |
| 首屏资源 gzip 估算 | 189.6 / 197.1 / 190.1 KB |
| 单个最大 chunk（原始） | 229,286 B（`28ki8qoah24nm.js`） |
| 同一 chunk 本机 gzip 实际下载 | **71,760 B** |
| 同一 chunk 经公网域名下载 | **229,286 B（未压缩）** |

复现：

```bash
node scripts/measure-first-load.mjs                          # 首屏体积（未压缩 + gzip 估算）
curl --compressed -o /dev/null -w '%{size_download}' <chunk>  # 真实下载字节
```

## 待办（需要动 VPS，未执行）

公网 nginx 只对 `text/html` 开了 gzip，`/_next/static/*` 原样透传。在站点配置里补：

```nginx
gzip on;
gzip_comp_level 5;
gzip_proxied any;
gzip_types text/css application/javascript application/json image/svg+xml;
```

预期把评审实际下载量从 648 KB 降到约 197 KB。
改 VPS 会影响同一台机器上的其他项目，所以只记录、未动手。

## 已确认无需处理

- 静态资源缓存头正确：`Cache-Control: public, max-age=31536000, immutable`；
- 没有任何外链字体或第三方请求（无 DNS/连接开销）；
- 没有把服务端依赖（mysql2 / node:crypto）误打进客户端包。
