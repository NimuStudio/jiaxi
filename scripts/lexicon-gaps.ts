/**
 * 词表缺口自动发现
 *
 * 背景：口语抽取的残余错误几乎都是「某种说法没被词表收录」。
 * 靠人眼发现太慢，所以每次评测后跑一遍这个脚本，自动列出缺口。
 *
 * 用法：node scripts/lexicon-gaps.ts
 * 产物：docs/lexicon-gaps.md
 *
 * 判定口径（关键）：一个词算「已覆盖」当且仅当它是某个别名的子串，
 * 或某个别名是它的子串 —— 「爸」被「爸爸/我爸」覆盖，不算缺口；
 * 「老爷子」「二舅」没有任何别名包含它，才是真缺口。
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { DISEASES, RELATIONS } from "../src/lib/extract/lexicon.ts";
import { relationsInText } from "../src/lib/extract/repair.ts";

/** 候选称谓：只列常见说法，避免把动词当称谓统计 */
const RELATION_WORDS = [
  "爸爸", "爸", "父亲", "老爸", "老爹", "老爷子", "俺爸", "爹",
  "妈妈", "妈", "母亲", "老妈", "老娘", "娘",
  "哥哥", "大哥", "二哥", "哥", "弟弟", "弟", "姐姐", "大姐", "二姐", "姐", "妹妹", "妹",
  "爷爷", "奶奶", "外公", "外婆", "姥爷", "姥姥", "祖父", "祖母",
  "大伯", "二伯", "三伯", "叔", "叔叔", "二叔", "三叔", "四叔", "大叔", "大爷", "二大爷",
  "姑", "姑姑", "姑妈", "三姑", "姨", "小姨", "大姨", "姨妈", "姨母",
  "舅", "舅舅", "二舅", "三舅", "小舅", "老舅", "舅妈",
  "堂哥", "表哥", "儿媳", "女婿", "孙子", "孙女", "公公", "婆婆", "老丈人",
];

const DISEASE_WORDS = [
  "高血压", "血压高", "血压偏高", "血压有点高", "血压稍高",
  "糖尿病", "血糖高", "血糖有点高", "血糖稍高",
  "心梗", "心肌梗死", "心肌梗塞", "冠心病", "心脏支架", "支架", "搭桥",
  "脑梗", "脑卒中", "脑出血", "中风", "心衰", "房颤", "痛风", "贫血", "骨质疏松",
  "甲亢", "甲减", "结石", "胃病", "哮喘", "慢阻肺", "肺气肿", "肾病", "尿毒症",
  "痴呆", "老年痴呆", "帕金森", "癌", "癌症", "肿瘤", "瘤子", "白血病", "淋巴瘤",
  "乳腺癌", "肺癌", "肝癌", "胃癌", "结直肠癌", "肠癌", "宫颈癌", "前列腺癌", "食管癌",
  "心脏不好", "心脏不太好", "心脏有问题", "甲状腺结节",
];

const files = existsSync("data/eval")
  ? readdirSync("data/eval").filter((f) => f.endsWith(".jsonl"))
  : [];
const texts: string[] = [];
for (const f of files) {
  for (const line of readFileSync(`data/eval/${f}`, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      texts.push((JSON.parse(line) as { input: string }).input);
    } catch {
      /* 跳过坏行 */
    }
  }
}

if (texts.length === 0) {
  console.error("没有找到评测集（data/eval/*.jsonl）");
  process.exit(1);
}

/**
 * 设计上不支持的关系：姻亲与曾祖辈。
 * 产品的关系枚举里没有它们，硬映射会造成误判（把「老丈人」当父亲），
 * 所以评测里这些句子的期望就是「不抽取」。列在这里避免每次都被当成缺口重复讨论。
 */
const KNOWN_UNSUPPORTED = ["老丈人", "丈母娘", "公公", "婆婆", "舅妈", "姑父", "姨夫", "太奶奶", "太爷爷", "曾祖"];

const present = (ws: string[]) => [...new Set(ws)].filter((w) => texts.some((t) => t.includes(w)));
const covered = (w: string, set: Set<string>) => [...set].some((a) => a.includes(w) || w.includes(a));

const kinAliases = new Set<string>();
for (const spec of RELATIONS) for (const a of spec.aliases) kinAliases.add(a);
const disAliases = new Set<string>();
for (const d of DISEASES) for (const a of [...d.nounAliases, ...(d.verbAliases ?? [])]) disAliases.add(a);

const kinGaps = present(RELATION_WORDS)
  .filter((w) => !covered(w, kinAliases) && !KNOWN_UNSUPPORTED.includes(w))
  .map((word) => ({ word, hits: texts.filter((t) => t.includes(word)).length }))
  .sort((a, b) => b.hits - a.hits);

const disGaps = present(DISEASE_WORDS)
  .filter((w) => !covered(w, disAliases))
  .map((word) => ({ word, hits: texts.filter((t) => t.includes(word)).length }))
  .sort((a, b) => b.hits - a.hits);

const missed = texts.filter((t) => relationsInText(t).length === 0);

const md = [
  "# 词表缺口（自动生成）",
  "",
  `扫描 ${files.length} 个评测文件、${texts.length} 条输入。重新生成：\`node scripts/lexicon-gaps.ts\``,
  "",
  "## 设计上不支持的称谓（不是缺口）",
  "",
  KNOWN_UNSUPPORTED.filter((w) => texts.some((t) => t.includes(w))).length
    ? KNOWN_UNSUPPORTED.filter((w) => texts.some((t) => t.includes(w))).map((w) => `- ${w}`).join("\n")
    : "无",
  "",
  "## 称谓缺口",
  "",
  kinGaps.length ? "| 词 | 出现次数 |\n|---|---|" : "无",
  ...kinGaps.map((g) => `| ${g.word} | ${g.hits} |`),
  "",
  "## 病种缺口",
  "",
  disGaps.length ? "| 词 | 出现次数 |\n|---|---|" : "无",
  ...disGaps.map((g) => `| ${g.word} | ${g.hits} |`),
  "",
  "## 完全识别不到称谓的句子",
  "",
  `共 ${missed.length} 条`,
  "",
  ...missed.slice(0, 50).map((t) => `- ${t}`),
  "",
].join("\n");

writeFileSync("docs/lexicon-gaps.md", md, "utf8");
console.log(`缺称谓 ${kinGaps.length} 个，缺病名 ${disGaps.length} 个，无称谓句 ${missed.length} 条`);
console.log("产物 -> docs/lexicon-gaps.md");
if (kinGaps.length || disGaps.length) process.exitCode = 0; // 有缺口是常态，不当作失败
