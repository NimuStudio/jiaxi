/**
 * 家系抽取评测
 *
 * 用固定的 golden set 打分，输出关系-疾病对 F1、年龄准确率、完全匹配率。
 * 这是微调前后的唯一对照基准 —— 没有它，"模型变好了"只是感觉。
 *
 * 运行：node scripts/eval-extract.ts   （需先启动 llama-server）
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extractPedigreeSplit, isLlmReady } from "../src/lib/extract/client.ts";
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

  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const evalFile = fileArg ? fileArg.slice(7) : "data/eval/pedigree-eval.jsonl";
  console.log(`评测集：${evalFile}\n`);
  const raw = readFileSync(evalFile, "utf8");
  const cases: EvalCase[] = raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as EvalCase);

  // 基线模型需要 few-shot 才可用；微调后的模型用 --no-few-shot 跑，两者对比才公平。
  const useFewShot = !process.argv.includes("--no-few-shot");
  console.log(`模式：${useFewShot ? "few-shot 基线" : "无 few-shot（微调模型）"}\n`);

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let exact = 0;
  let ageChecked = 0;
  let ageCorrect = 0;
  const failures: string[] = [];
  const perCase: Array<Record<string, unknown>> = [];

  for (const c of cases) {
    let actual: ExtractedPerson[] = [];
    try {
      const r = await extractPedigreeSplit(c.input, { fewShot: useFewShot });
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
    perCase.push({
      id: c.id,
      input: c.input,
      expected: c.expected,
      actual,
      missing,
      extra,
      exact: isExact,
    });
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
  // 留痕：没有产物文件的指标等于没有指标。commit + 模型 + 数据集 + 逐条结果一起存。
  let commit = "unknown";
  try {
    commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    /* 非 git 环境 */
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = "docs/eval-results";
  mkdirSync(outDir, { recursive: true });
  const outFile = `${outDir}/${stamp}-${evalFile.split("/").pop()?.replace(".jsonl", "")}.json`;
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        commit,
        model: process.env.LLAMA_MODEL_PATH ?? process.env.LLAMA_SERVER_URL ?? "127.0.0.1:8080",
        evalFile,
        fewShot: useFewShot,
        n: cases.length,
        tp, fp, fn, precision, recall, f1,
        ageChecked, ageCorrect, ageAcc,
        exact,
        exactRate: exact / cases.length,
        failures,
        perCase,
      },
      null,
      1,
    ),
    "utf8",
  );
  console.log(`\n产物 -> ${outFile}`);

  if (failures.length) {
    console.log(`调用失败 ${failures.length} 条：`);
    failures.forEach((f) => console.log("  " + f));
  }
  console.log("═".repeat(60));
}

void main();
