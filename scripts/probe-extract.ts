/**
 * 抽取效果探针
 * 用几条真实口语，看「Qwen3-1.7B + GBNF 约束」这个基线到底抽得怎么样。
 * 运行：node scripts/probe-extract.ts   （需先启动 llama-server）
 */
import { extractPedigree, isLlmReady } from "../src/lib/extract/client.ts";

const CASES = [
  "我爸 52 岁放的支架，我爷爷有糖尿病。",
  "我老娘是脑溢血走的，走的时候六十来岁吧，具体记不清了。",
  "我舅舅 45 岁查出来糖尿病，我妈身体还行。",
  "我外婆、我姨妈都有乳腺癌，姨妈是 48 岁查出来的。",
  "我今年 31，体检报告写着未见异常，但我爸 55 岁心梗。",
];

async function main() {
  const ready = await isLlmReady();
  if (!ready) {
    console.error("本地推理服务未就绪：请先启动 llama-server（127.0.0.1:8080）");
    process.exit(1);
  }

  // 默认与基线一致（带 few-shot）；加 --no-few-shot 测微调模型。
  // 这两个模式差别极大，务必显式打印，避免把「零示例」的结果当成模型真实水平。
  const fewShot = !process.argv.includes("--no-few-shot");
  console.log(`模式：${fewShot ? "few-shot（基线）" : "无 few-shot（微调模型）"}\n`);

  for (const text of CASES) {
    const t0 = Date.now();
    console.log("─".repeat(72));
    console.log("输入：", text);
    try {
      const result = await extractPedigree(text, { fewShot });
      const ms = Date.now() - t0;
      console.log(`输出（${ms}ms）：`);
      for (const p of result.persons) {
        const conds =
          p.conditions.length === 0
            ? "无"
            : p.conditions
                .map((c) => `${c.code}${c.onsetAge === null ? "" : `@${c.onsetAge}岁`}`)
                .join("、");
        console.log(`  · ${p.relation} (${p.sex}) → ${conds}`);
      }
    } catch (e) {
      console.log("失败：", (e as Error).message);
    }
  }
  console.log("─".repeat(72));
}

void main();
