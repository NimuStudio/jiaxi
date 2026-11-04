/**
 * 家系抽取评测
 *
 * 用固定的 golden set 打分，输出关系-疾病对 F1、年龄准确率、完全匹配率。
 * 这是微调前后的唯一对照基准 —— 没有它，"模型变好了"只是感觉。
 *
 * 运行：node scripts/eval-extract.ts   （需先启动 llama-server）
 */
import { readFileSync } from "node:fs";
import { extractPedigree, isLlmReady } from "../src/lib/extract/client.ts";
import type { ExtractedPerson } from "../src/lib/extract/client.ts";

interface EvalCase {
  id: string;
  input: string;
  expected: ExtractedPerson[];
}

/** 把「人 × 病」展开成可比较的键值对。 */
function toPairs(persons: ExtractedPerson[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const p of persons) {
    for (const c of p.conditions) {
      const key = `${p.relation}|${c.code}`;
      // 同一对重复出现时，保留带年龄的那条
      if (!map.has(key) || map.get(key) === null) {
        map.set(key, c.onsetAge);
      }
    }
  }
  return map;
}

const AGE_TOLERANCE = 2;

function ageMatches(expected: number | null, actual: number | null): boolean {
  if (expected === null) return actual === null;
  if (actual === null) return false;
  return Math.abs(expected - actual) <= AGE_TOLERANCE;
}

async function main() {
  if (!(await isLlmReady())) {
    console.error("本地推理服务未就绪：请先启动 llama-server（127.0.0.1:8080）");
    process.exit(1);
  }

  const raw = readFileSync("data/eval/pedigree-eval.jsonl", "utf8");
  const cases: EvalCase[] = raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as EvalCase);

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let exact = 0;
  let ageChecked = 0;
  let ageCorrect = 0;
  const failures: string[] = [];

  for (const c of cases) {
    let actual: ExtractedPerson[] = [];
    try {
      const r = await extractPedigree(c.input);
      actual = r.persons;
    } catch (e) {
      failures.push(`${c.id} 调用失败：${(e as Error).message}`);
      fn += c.expected.reduce((n, p) => n + p.conditions.length, 0);
      continue;
    }

    const exp = toPairs(c.expected);
    const act = toPairs(actual);

    let caseTp = 0;
    let caseFp = 0;
    let caseFn = 0;
    const missing: string[] = [];
    const extra: string[] = [];

    for (const [k, expAge] of exp) {
      if (act.has(k)) {
        caseTp++;
        ageChecked++;
        if (ageMatches(expAge, act.get(k) ?? null)) ageCorrect++;
      } else {
        caseFn++;
        missing.push(k);
      }
    }
    for (const k of act.keys()) {
      if (!exp.has(k)) {
        caseFp++;
        extra.push(k);
      }
    }

    tp += caseTp;
    fp += caseFp;
    fn += caseFn;

    const isExact = caseFp === 0 && caseFn === 0;
    if (isExact) exact++;

    const mark = isExact ? "✅" : "❌";
    const detail = [
      missing.length ? `缺 ${missing.join(",")}` : "",
      extra.length ? `多 ${extra.join(",")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    console.log(`${mark} ${c.id} ${detail}`);
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const ageAcc = ageChecked === 0 ? 0 : ageCorrect / ageChecked;

  console.log("");
  console.log("═".repeat(60));
  console.log(`样本数            ${cases.length}`);
  console.log(`关系-疾病对  TP/FP/FN  ${tp}/${fp}/${fn}`);
  console.log(`  Precision       ${precision.toFixed(3)}`);
  console.log(`  Recall          ${recall.toFixed(3)}`);
  console.log(`  F1              ${f1.toFixed(3)}`);
  console.log(`年龄准确率        ${ageCorrect}/${ageChecked} = ${ageAcc.toFixed(3)}`);
  console.log(`完全匹配          ${exact}/${cases.length} = ${(exact / cases.length).toFixed(3)}`);
  if (failures.length) {
    console.log(`调用失败 ${failures.length} 条：`);
    failures.forEach((f) => console.log("  " + f));
  }
  console.log("═".repeat(60));
}

void main();
