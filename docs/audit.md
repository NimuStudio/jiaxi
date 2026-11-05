# 全项目审计（2026-11-06）

5 个只读子代理分模块审计 + 主控逐条复核。本文记录**已修**与**未修（含原因）**，
未修条目不是忘了，而是需要设计决策或成本高于收益。

## 已修（13 处，含 4 个 P0）

| 严重度 | 问题 | 位置 |
| --- | --- | --- |
| P0 | `?demo=1` 的虚构家系写进 localStorage 与云端档案 | app/chat/page.tsx |
| P0 | 并列句串病：「爷爷高血压、奶奶糖尿病」→ 两人都得上两个病 | src/lib/extract/client.ts |
| P0 | 步数耗尽时把检索词当最终回答输出 | src/lib/agent/loop.ts |
| P0 | 家族史 1.51 倍被套到哮喘/慢阻肺（文献只支持肺癌） | src/lib/risk/exposure.ts |
| P1 | 弹层每敲一个字符抢回焦点，三个弹层无法输入 | src/components/ui/GlassModal.tsx |
| P1 | /chat 挂载即清空本地家系，/cvd 的家族史链路失效 | app/chat/page.tsx |
| P1 | /cvd 大字 10.9% 与说明 10.8% 自相矛盾；导入化验单不清示例标记 | app/cvd/page.tsx |
| P1 | 读失败被当成「云端为空」→ 客户端覆盖云端 | app/api/me/*、app/chat/page.tsx |
| P1 | 体检数字两套校验、无生理值域、缺失字段静默当 false | src/lib/risk/factors-validate.ts |
| P1 | 检索 500 / 抽取断流都渲染成「没有找到」 | EvidencePanel、ChatPanel |
| P1 | 「剩下的分数来自年龄和家族史」漏了降压药 2 分 | ReclaimSimulator、FactorControls |
| P1 | 台账「待核实」与界面在用冲突；家族史转负年龄 61→58 | docs/references.md、chinapar.ts |
| P2 | 内部提示词泄漏到轨迹面板 | StepList.tsx |

## 未修（附原因与建议）

### 需要设计决策

1. ~~**RAG 引用门控两个方向都错**~~ —— **已修（2026-11-06）**
   原问题：门控只看「条目的 tag 是不是问题里的子串」，于是
   ① 放行跨主题条目（糖尿病家族史问题可引用《心血管病家族史怎么进入 China-PAR》，
      因为两条共用 tag「家族史」）；② 误杀正确条目（「哪个条目分值最高」时 14.52 分的
      正确条目被删，用户被告知「没有引用知识库条目」）。
   修法：给 16 条 KB 条目加 topic（diabetes 12 条 / ascvd 3 条 / both 1 条），
   门控改为「主题兼容 且（tag 命中 或 标题与问题共享实词）」。
   实测：糖代谢家族史问题只引到糖尿病条目；「哪个条目分值最高」恢复引用；
   「光合作用是什么」仍无引用。新增 6 条单测（topic-gate.test.ts）。
   试过但回退的方案：「实词覆盖率 ≥0.5 / 命中 ≥2」会误杀「腰围怎么量」这类正常问句。

2. **数字守卫只验「数字出现过」**（loop.ts:133-147）
   观察值里同时含 7 和 4 时，「可回收率 4%」这种错配能通过。
   **建议**：把数字与 facts 字段绑定（分数配分数、百分比配风险），而不是做全局词表。

### 成本高于收益（当前阶段）

3. ~~抽取层的否定/不确定极性判定~~ —— **已修（2026-11-06）**：新增 dropNegatedOrUncertain，逐分句判断否定（含转折处理）与不确定表述；实测「我爷爷没有糖尿病」不再产出节点，5 条单测。
   需要一套极性规则 + few-shot 重训，属于模型行为调整，改动风险大。
4. 家系树在 `toFamilyTree`（agent/tools.ts）丢失原话与年龄确定性（rawText 置空、certainty 恒 approx）。
   要让「每个数字可追溯」贯穿到 agent 层，需要改数据结构与界面。
5. 登录无频率限制（已在 /api/auth/login 加 10 次/10 分钟内存限流），
   多实例部署需要换共享存储（Redis）。
6. `next.config.ts` 无 CSP / X-Frame-Options / HSTS。
   线上是单机演示环境，加 headers 需要逐条验证不打断 Next 的内联样式与 WebGL。

### 已知小问题（不影响结论）

- globals.css 有一批历史遗留死规则（`.login-seam-half*`、`.login-diagonal-spark` 等）。
- `/chat`、`/cvd` 没有各自的 metadata，三个页面标题相同。
- `GlassModal` 无焦点陷阱、关闭后不归还焦点。
- `RequireLogin` 在认证探测期间整页空白（无骨架屏）。
- 首页 percent 文案已改为「该分档对应的人群参考值」，但 KB 里对应的措辞仍需统一。
