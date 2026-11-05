/**
 * Agent 行为探针
 *
 * 目的不是「跑通」，而是看 1.7B 会不会犯这几类错：
 *  - 一直调同一个工具，不收敛
 *  - 该查知识库时不查，直接编
 *  - 编造工具没返回的数字
 *
 * 用法：node scripts/probe-agent.ts
 */

import { runAgent } from "../src/lib/agent/loop.ts";
import type { RiskFactors } from "../src/lib/agent/tools.ts";
import { isLlmReady } from "../src/lib/extract/client.ts";
import kbData from "../data/kb/findrisc-kb.json" with { type: "json" };
import type { KnowledgeEntry } from "../src/lib/rag/search.ts";

const PERSONS = [
  {
    relation: "father",
    sex: "male" as const,
    conditions: [{ code: "myocardial-infarction", onsetAge: 52 }],
  },
  {
    relation: "maternal-uncle",
    sex: "male" as const,
    conditions: [{ code: "type2-diabetes", onsetAge: 45 }],
  },
  {
    relation: "maternal-grandmother",
    sex: "female" as const,
    conditions: [{ code: "lung-cancer", onsetAge: null }],
  },
];

const FACTORS: RiskFactors = {
  age: 48,
  sex: "male",
  bmi: 27,
  waistCm: 96,
  physicallyActive: false,
  eatsVegetablesDaily: false,
  onAntihypertensive: true,
  historyOfHighGlucose: false,
};

const QUESTIONS = [
  "我的糖尿病风险有多高？",
  "我舅舅有糖尿病，我该注意什么？",
  "为什么要关心家族史？",
];

async function main() {
  if (!(await isLlmReady())) {
    console.error("推理服务未就绪（127.0.0.1:8080）");
    process.exit(1);
  }

  for (const q of QUESTIONS) {
    console.log("═".repeat(74));
    console.log("问：", q);
    const t0 = Date.now();
    try {
      const r = await runAgent(q, {
        persons: PERSONS,
        factors: FACTORS,
        kb: kbData as KnowledgeEntry[],
      });
      r.steps.forEach((s, i) => {
        console.log(`  ${i + 1}. [${s.action}] 思考：${s.thought}`);
        if (s.input) console.log(`     输入：${s.input}`);
        if (s.observation) {
          console.log(`     观察：${s.observation.replace(/\n/g, "\n           ")}`);
        }
      });
      console.log("答：", r.answer);
      if (r.facts.risk) {
        const k = r.facts.risk;
        console.log(
          `  事实卡：${k.score} 分 → ${k.percent}%，可回收 ${k.reclaimablePoints} 分 → 达标 ${k.goalPercent}%`,
        );
        console.log("         明细：", k.items.map((x) => `${x.label}${x.points}`).join("、"));
      }
      if (r.facts.pedigree.length) console.log("  家系摘要：", r.facts.pedigree.join(" / "));
      if (r.facts.citations.length) console.log("  引用：", r.facts.citations.join(" / "));
      console.log(`  （${r.steps.length} 步，${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    } catch (e) {
      console.log("  失败：", (e as Error).message);
    }
  }
}

main();
