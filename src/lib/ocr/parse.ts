/**
 * 化验单识别结果的解析与字段映射（纯函数，便于测试）。
 *
 * 分工：模型只负责"看图抄字"，字段映射与单位换算由这里的规则做——
 * 因为映射错了会导致风险算错，这一步不能交给模型自由发挥。
 */

export interface LabItem {
  name: string;
  /** 原始数值文本（模型可能带单位或箭头，这里统一洗成数字） */
  value: number | null;
  unit: string;
  ref: string;
}

/** 模型输出的 JSON 可能被代码块包裹、可能有中文引号，尽量宽容地取出来 */
export function parseOcrJson(raw: string): LabItem[] {
  const text = raw.replace(/\`\`\`(?:json)?/gi, "").trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: LabItem[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (name.length === 0) continue;
    const value = toNumber(String(r.value ?? ""));
    out.push({
      name,
      value,
      unit: String(r.unit ?? "").trim(),
      ref: String(r.ref ?? "").trim(),
    });
  }
  return out;
}

/** 从「6.8」「6.8 mmol/L」「↑6.8」「＜3」这类文本里抠出数字 */
export function toNumber(text: string): number | null {
  const cleaned = text
    .replace(/[＜<]\s*(?=\d)/g, "")
    .replace(/[＞>]\s*(?=\d)/g, "")
    .replace(/↑|↓|／|\s+/g, "")
    .replace(/[^0-9.\-]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 能映射到 China-PAR 的字段 */
export interface MappedFields {
  age?: number;
  sbp?: number;
  totalCholesterolMmol?: number;
  hdlMmol?: number;
}

export interface MapResult {
  fields: MappedFields;
  /** 识别到但本页用不上的项（仍然返回，界面可以展示，避免"看不见的丢弃"） */
  unused: LabItem[];
}

/** 项目名 → 字段。用包含判断，因为各家医院的写法差异很大。 */
const RULES: Array<{ field: keyof MappedFields; match: RegExp }> = [
  { field: "totalCholesterolMmol", match: /总胆固醇|胆固醇\s*TC|\bTC\b/i },
  { field: "hdlMmol", match: /高密度脂蛋白|\bHDL\b/i },
  { field: "sbp", match: /收缩压|高压/ },
  { field: "age", match: /^年龄$|患者年龄/ },
];

/**
 * 把化验项映射到 China-PAR 字段。
 *
 * 注意：只映射**能从化验单上直接读到**的字段。BMI、腰围这类化验单通常没有，
 * 不做猜测；血糖/糖化血红蛋白也不直接等于"已诊断糖尿病"，所以不映射到 diabetic，
 * 避免把"血糖偏高"误判成"糖尿病"影响风险方程。
 */
export function mapLabItems(items: LabItem[]): MapResult {
  const fields: MappedFields = {};
  const unused: LabItem[] = [];

  for (const item of items) {
    const rule = RULES.find((r) => r.match.test(item.name));
    if (!rule || item.value === null) {
      unused.push(item);
      continue;
    }
    // 只有胆固醇类需要单位换算；年龄与血压用原始值（mmHg 不该走 mmol 换算）
    const needsConversion =
      rule.field === "totalCholesterolMmol" || rule.field === "hdlMmol";
    const value = needsConversion ? toMmol(item.value, item.unit) : item.value;
    if (value === null) {
      unused.push(item);
      continue;
    }
    // 同一字段出现多次时保留第一个（化验单通常只有一条）
    if (fields[rule.field] === undefined) fields[rule.field] = value;
  }

  return { fields, unused };
}

/**
 * 单位换算：China-PAR 用 mmol/L，化验单有时是 mg/dL。
 * 换算系数：胆固醇类 ×0.02586（mg/dL → mmol/L）；血压不做换算。
 */
export function toMmol(value: number, unit: string): number | null {
  const u = unit.toLowerCase().replace(/\s/g, "");
  if (u.includes("mg/dl") || u.includes("mg/dL".toLowerCase())) {
    return Math.round(value * 0.02586 * 100) / 100;
  }
  if (u === "" || u.includes("mmol")) return value;
  // 单位不认识就别猜，宁可当未映射
  return null;
}
