/**
 * 遗传模式的类型与文案：只放纯数据，供**客户端组件**直接引用。
 *
 * 为什么要单独一个文件：HereditaryMode 是客户端组件，如果它从 hereditary.ts 取常量，
 * 会把 hereditary.ts 的依赖（lexicon 的整份疾病词表 + viz 的布局表）一起打进浏览器包。
 * 实测客户端 chunk 里出现过「心脑血管」这类词表文本，就是这条链路漏出去的。
 */

export type HereditaryMode =
  | "autosomal-dominant"
  | "autosomal-recessive"
  | "x-linked"
  | "mitochondrial"
  | "insufficient";

export const MODE_LABEL: Record<HereditaryMode, string> = {
  "autosomal-dominant": "常染色体显性",
  "autosomal-recessive": "常染色体隐性",
  "x-linked": "X 连锁",
  mitochondrial: "线粒体遗传",
  insufficient: "证据不足",
};

/** 低于这个置信度就不给结论，只报「证据不足」 */
export const CONFIDENCE_FLOOR = 0.55;

export interface HereditaryDecision {
  mode: HereditaryMode;
  /** 模型原始给出的众数选项（可能被置信度门槛否掉） */
  rawMode: HereditaryMode | null;
  confidence: number;
  probabilities: Partial<Record<HereditaryMode, number>>;
  /** model = 真决策模型；structural = 本地训练的结构模型；scored = logprob 近似；rules = 兜底 */
  source: "model" | "structural" | "scored" | "rules";
  reason: string;
  /** 判不了时缺什么：前端用它追问，而不是只说「证据不足」 */
  gaps: string[];
}
