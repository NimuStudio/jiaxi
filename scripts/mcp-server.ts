/**
 * 家系 · MCP Server（stdio 传输）
 *
 * 把系统里的三个真实能力暴露成标准 MCP 工具，任何 MCP 客户端
 * （Claude Desktop、Cursor、其他 Agent 应用）都能直接调用：
 *
 *   summarize_pedigree —— 汇总家族史（哪级亲属、什么病、几岁发病）
 *   compute_risk       —— FINDRISC 10 年糖尿病风险 + 可回收分
 *   search_knowledge   —— 检索已核实的健康知识库（BM25）
 *
 * 复用 src/lib 里的同一套纯函数——MCP 层不是重写，只是换一种协议暴露。
 * 网站内的 Agent 走自研 Function Calling 循环，外部世界走 MCP 标准，
 * 两条通道共享同一个实现，这正是「工具层与协议层解耦」的直接证据。
 *
 * 运行（stdio）：
 *   npx tsx scripts/mcp-server.ts
 * 客户端配置示例见 README「MCP 接入」一节。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  runTool,
  type ToolContext,
} from "../src/lib/agent/tools.ts";
import type { ExtractedPerson } from "../src/lib/extract/client.ts";
import type { KnowledgeEntry } from "../src/lib/rag/search.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KB_PATH = path.join(HERE, "..", "data", "kb", "findrisc-kb.json");

async function loadKb(): Promise<KnowledgeEntry[]> {
  try {
    return JSON.parse(await readFile(KB_PATH, "utf8")) as KnowledgeEntry[];
  } catch {
    console.error("[mcp] 知识库加载失败：", KB_PATH);
    return [];
  }
}

const PersonsSchema = z
  .array(
    z.object({
      relation: z.string().describe("亲属关系编码，如 father / maternal-uncle"),
      sex: z.enum(["male", "female", "unknown"]),
      conditions: z
        .array(
          z.object({
            code: z.string().describe("疾病编码，如 type2-diabetes"),
            onsetAge: z.number().nullable().describe("发病年龄，未知填 null"),
          }),
        )
        .describe("该亲属的患病记录"),
    }),
  )
  .describe("家系节点列表（结构来自家系抽取链路）");

const FactorsSchema = z.object({
  age: z.number(),
  sex: z.enum(["male", "female"]),
  bmi: z.number(),
  waistCm: z.number(),
  physicallyActive: z.boolean(),
  eatsVegetablesDaily: z.boolean(),
  onAntihypertensive: z.boolean(),
  historyOfHighGlucose: z.boolean(),
});

async function main() {
  const kb = await loadKb();
  const server = new McpServer(
    { name: "pedigree-jiaxi", version: "1.0.0" },
    {
      instructions:
        "家系（JiaXi）工具集：家族史汇总、FINDRISC 糖尿病风险量化（含可回收风险）、已核实健康知识库检索。",
    },
  );

  server.tool(
    "summarize_pedigree",
    "汇总家族病史：哪些病、一级/二级亲属各几人、最早发病年龄。这是下游风险计算的输入。",
    { persons: PersonsSchema },
    async ({ persons }) => {
      const ctx: ToolContext = { persons, factors: null, kb };
      const r = runTool("summarize_pedigree", "", ctx);
      return { content: [{ type: "text", text: r.observation }] };
    },
  );

  server.tool(
    "compute_risk",
    "计算本人未来 10 年 2 型糖尿病风险（FINDRISC），以及其中多少分可以靠生活方式拿回来（可回收风险）。需要体检数字与家系节点。",
    { persons: PersonsSchema, factors: FactorsSchema },
    async ({ persons, factors }) => {
      const ctx: ToolContext = { persons, factors, kb };
      const r = runTool("compute_risk", "", ctx);
      return { content: [{ type: "text", text: r.observation }] };
    },
  );

  server.tool(
    "search_knowledge",
    "在已核实的健康知识库（FINDRISC / China-PAR / 家族史相关指南条目）里检索依据。查不到会如实返回，不会编造。",
    { query: z.string().describe("检索词，如「家族史为什么权重最高」") },
    async ({ query }) => {
      const ctx: ToolContext = { persons: [], factors: null, kb };
      const r = runTool("search_knowledge", query, ctx);
      return { content: [{ type: "text", text: r.observation }] };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] 家系 MCP server 已启动（stdio），暴露 3 个工具");
}

main().catch((err) => {
  console.error("[mcp] 启动失败：", err);
  process.exit(1);
});
