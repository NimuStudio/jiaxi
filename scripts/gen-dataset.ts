/**
 * 家系抽取训练数据生成器
 *
 * 【为什么不直接让大模型生成数据】
 * 那样标注可能一错到底，训出来的模型学的是错的东西。
 * 这里反过来：先随机构造**语义结构**（谁、什么病、几岁），
 * 再把这个结构渲染成自然中文。标注直接来自结构，100% 正确。
 *
 * 输出格式与 ml/train_lora.py 兼容：{"messages": [{system},{user},{assistant}]}
 *
 * 运行：node scripts/gen-dataset.ts --n 1200 --out data/train
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { RELATIONS, DISEASES } from "../src/lib/extract/lexicon.ts";
import { SYSTEM_PROMPT } from "../src/lib/extract/prompt.ts";

type Rnd = () => number;

function mulberry32(seed: number): Rnd {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rnd: Rnd, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)] as T;
}

function int(rnd: Rnd, min: number, max: number): number {
  return min + Math.floor(rnd() * (max - min + 1));
}

function chance(rnd: Rnd, p: number): boolean {
  return rnd() < p;
}

const CN_DIGIT = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 中文数字，覆盖 0–99（年龄够用）。 */
function cn(n: number): string {
  if (n < 10) return CN_DIGIT[n] as string;
  if (n < 20) return "十" + (n % 10 === 0 ? "" : (CN_DIGIT[n % 10] as string));
  const tens = Math.floor(n / 10);
  const rest = n % 10;
  return (CN_DIGIT[tens] as string) + "十" + (rest === 0 ? "" : (CN_DIGIT[rest] as string));
}

interface Cond {
  code: string;
  onsetAge: number | null;
}

interface PersonSpec {
  relation: string;
  sex: string;
  conditions: Cond[];
}

/** 年龄的多种说法。所有变体都归一到同一个整数，模型学的是「表达 → 数字」。 */
function renderAge(rnd: Rnd, age: number): string {
  const style = int(rnd, 0, 4);
  if (style === 0) return `${age}岁`;
  if (style === 1) return `${cn(age)}岁`;
  if (style === 2) return age % 10 === 0 ? `${cn(age)}来岁` : `${cn(age)}岁左右`;
  if (style === 3) return `${age}岁那年`;
  return age % 10 === 0 ? `${cn(age)}多岁` : `差不多${cn(age)}岁`;
}

const CAUSE_VERBS = ["走的", "去世的", "没的"];
const FIND_VERBS = ["查出来", "确诊", "发现"];

/**
 * 把「人 + 病」渲染成一句自然的人话。
 *
 * 关键约束：名词性说法（糖尿病）接「有 / 得了」，
 * 谓语性说法（放了支架）直接作谓语，不能混用，否则会生成
 * 「有放了支架」这种病句。
 */
function renderPerson(rnd: Rnd, p: PersonSpec): string {
  const spec = RELATIONS.find((r) => r.relation === p.relation);
  const who = spec ? pick(rnd, spec.aliases) : "亲戚";
  const first = p.conditions[0];
  if (!first) return `${who}身体还行`;

  // 两个病：只用名词性说法并列（谓语性短语无法并列进「有 X 和 Y」）
  if (p.conditions.length >= 2) {
    const names = p.conditions
      .map((c) => {
        const d = DISEASES.find((x) => x.code === c.code);
        return d ? pick(rnd, d.nounAliases) : null;
      })
      .filter((x): x is string => x !== null);
    if (names.length >= 2) {
      const joiner = pick(rnd, ["和", "、", "还有"]);
      return `${who}有${names[0]}${joiner}${names[1]}`;
    }
  }

  const diseaseSpec = DISEASES.find((d) => d.code === first.code);
  if (!diseaseSpec) return `${who}身体还行`;

  // 谓语性说法：直接作谓语
  const verbAliases = diseaseSpec.verbAliases;
  if (verbAliases && verbAliases.length > 0 && chance(rnd, 0.28)) {
    const verb = pick(rnd, verbAliases);
    if (first.onsetAge === null) return `${who}${verb}`;
    return `${who}${renderAge(rnd, first.onsetAge)}${verb}`;
  }

  // 名词性说法
  const noun = pick(rnd, diseaseSpec.nounAliases);
  if (first.onsetAge === null) {
    const form = int(rnd, 0, 2);
    if (form === 0) return `${who}有${noun}`;
    if (form === 1) return `${who}得了${noun}`;
    return `${who}有${noun}，好多年了`;
  }

  const ageText = renderAge(rnd, first.onsetAge);
  const form = int(rnd, 0, 2);
  if (form === 0) return `${who}${ageText}${noun}`;
  if (form === 1) return `${who}${ageText}${pick(rnd, FIND_VERBS)}${noun}`;
  return `${who}${ageText}${noun}${pick(rnd, CAUSE_VERBS)}`;
}

/** 随机的年龄：偏中老年，符合家族病史的实际分布。 */
function randomAge(rnd: Rnd): number {
  const bucket = int(rnd, 0, 2);
  if (bucket === 0) return int(rnd, 40, 59);
  if (bucket === 1) return int(rnd, 60, 79);
  return int(rnd, 45, 85);
}

/** 生成一条样本：语义结构 + 渲染句子。 */
function makeSample(rnd: Rnd): { text: string; persons: PersonSpec[] } {
  const personCount = chance(rnd, 0.55) ? 1 : chance(rnd, 0.75) ? 2 : 3;

  // 不重复地选关系
  const pool = [...RELATIONS];
  const chosen: PersonSpec[] = [];
  for (let i = 0; i < personCount && pool.length > 0; i++) {
    const idx = Math.floor(rnd() * pool.length);
    const rel = pool.splice(idx, 1)[0];
    if (!rel) break;

    const condCount = chance(rnd, 0.78) ? 1 : 2;
    const condPool = [...DISEASES];
    const codes: string[] = [];
    for (let j = 0; j < condCount && condPool.length > 0; j++) {
      const ci = Math.floor(rnd() * condPool.length);
      const d = condPool.splice(ci, 1)[0];
      if (!d) break;
      codes.push(d.code);
    }
    if (codes.length === 0) continue;

    // 多病时句子里不逐个交代年龄（"老爸有糖尿病和脑卒中"），
    // 标注也必须统一为 null —— 否则就是「句子里没说，标注却有」，
    // 模型会学成"没提到也编一个年龄"。
    const multi = codes.length >= 2;
    const conditions: Cond[] = codes.map((code) => ({
      code,
      onsetAge: !multi && chance(rnd, 0.7) ? randomAge(rnd) : null,
    }));
    chosen.push({
      relation: rel.relation,
      sex: rel.sex,
      conditions,
    });
  }

  if (chosen.length === 0) {
    // 极端情况兜底
    const rel = pick(rnd, RELATIONS);
    chosen.push({
      relation: rel.relation,
      sex: rel.sex,
      conditions: [{ code: pick(rnd, DISEASES).code, onsetAge: null }],
    });
  }

  // 渲染各人子句
  const clauses = chosen.map((p) => renderPerson(rnd, p));

  // 30% 概率加一句「干扰」：某个没被抽到的亲属，身体还行 / 没有这病
  let text = "";
  const useDistractor = chance(rnd, 0.32);
  const distractorRel = useDistractor
    ? RELATIONS.find((r) => !chosen.some((c) => c.relation === r.relation))
    : undefined;

  const joined = clauses.join(pick(rnd, ["，", "。", "；"]));

  if (distractorRel) {
    const who = pick(rnd, distractorRel.aliases);
    const negated = pick(rnd, ["身体还行", "没这毛病", "查过没事", "挺好的"]);
    text = `${joined}。${who}${negated}。`;
  } else {
    text = `${joined}。`;
  }

  return { text, persons: chosen };
}

function toAssistantJson(persons: PersonSpec[]): string {
  const obj = {
    persons: persons.map((p) => ({
      relation: p.relation,
      sex: p.sex,
      conditions: p.conditions.map((c) => ({
        code: c.code,
        onsetAge: c.onsetAge,
      })),
    })),
  };
  return JSON.stringify(obj);
}

function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string, fallback: string): string => {
    const i = args.indexOf(name);
    return i >= 0 && args[i + 1] ? (args[i + 1] as string) : fallback;
  };

  const n = Number(getArg("--n", "1200"));
  const outDir = getArg("--out", "data/train");
  const seed = Number(getArg("--seed", "20261104"));

  const rnd = mulberry32(seed);
  const trainLines: string[] = [];
  const valLines: string[] = [];
  const relCount = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const { text, persons } = makeSample(rnd);
    const record = JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
        { role: "assistant", content: toAssistantJson(persons) },
      ],
    });
    // 9:1 切分
    if (i % 10 === 0) valLines.push(record);
    else trainLines.push(record);

    for (const p of persons) {
      relCount.set(p.relation, (relCount.get(p.relation) ?? 0) + 1);
    }
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/train.jsonl`, trainLines.join("\n") + "\n", "utf8");
  writeFileSync(`${outDir}/val.jsonl`, valLines.join("\n") + "\n", "utf8");

  console.log(`生成完成：train ${trainLines.length} 条，val ${valLines.length} 条`);
  console.log("各关系出现次数（检查覆盖是否均匀）：");
  for (const spec of RELATIONS) {
    const c = relCount.get(spec.relation) ?? 0;
    const bar = "█".repeat(Math.round(c / 8));
    console.log(`  ${spec.relation.padEnd(22)} ${String(c).padStart(4)} ${bar}`);
  }
}

main();
