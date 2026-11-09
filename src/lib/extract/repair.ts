/**
 * 抽取结果的确定性修补层
 *
 * 只做「规则能确定的事」，不猜模型该干的事。三类修补都来自口语集实测失败：
 *  1. 称谓纠正：模型把「我哥」抽成 paternal-uncle、「爸」抽成 paternal-uncle
 *     —— 用文中出现的称谓词做一次确定性的重映射
 *  2. 病种回退 other：模型把「房颤/慢阻肺/老年痴呆」抽成 other
 *     —— 若原文命中词表别名就换回真编码；若原文压根没有病名词（如「一直在吃药」）就丢掉这条
 *  3. 续句继承：「我妈高血压，我哥也是」里第二句没有病名，被判为不相关而丢弃
 *     —— 把上一句的病名补进这句再送模型
 */

import { DISEASES, RELATIONS } from "./lexicon.ts";
import type { ExtractedPerson } from "./client.ts";

/** 文中出现的称谓词 → 关系，按出现位置排序 */
export function relationsInText(text: string): string[] {
  const hits: Array<{ at: number; relation: string }> = [];
  for (const spec of RELATIONS) {
    for (const alias of spec.aliases) {
      const at = text.indexOf(alias);
      if (at >= 0) hits.push({ at, relation: spec.relation });
    }
  }
  // 同一位置多个别名时取最长（「我爷爷」优先于「爷爷」）
  hits.sort((a, b) => a.at - b.at);
  const out: string[] = [];
  for (const h of hits) if (!out.includes(h.relation)) out.push(h.relation);
  return out;
}

/**
 * 称谓纠正：模型给的 relation 若在文中找不到依据，就用文中剩余称谓补上。
 * 只在「文中确实提到了称谓」时动手，不动纯推测的情况。
 */
export function repairRelations(
  text: string,
  persons: ExtractedPerson[],
): ExtractedPerson[] {
  const mentioned = relationsInText(text);
  if (mentioned.length === 0) return persons;

  const used = new Set(persons.map((p) => p.relation).filter((r) => mentioned.includes(r)));
  return persons.map((p) => {
    if (mentioned.includes(p.relation)) return p;
    const spare = mentioned.find((r) => !used.has(r));
    if (!spare) return p;
    used.add(spare);
    const spec = RELATIONS.find((s) => s.relation === spare);
    return { ...p, relation: spare, sex: spec?.sex ?? p.sex };
  });
}

/** 原文里实际命中的病种编码（按别名长短优先） */
export function diseaseCodesInText(text: string): string[] {
  const hits: Array<{ at: number; len: number; code: string }> = [];
  for (const d of DISEASES) {
    for (const alias of [...d.nounAliases, ...(d.verbAliases ?? [])]) {
      const at = text.indexOf(alias);
      if (at >= 0) hits.push({ at, len: alias.length, code: d.code });
    }
  }
  hits.sort((a, b) => a.at - b.at || b.len - a.len);
  const out: string[] = [];
  for (const h of hits) if (!out.includes(h.code)) out.push(h.code);
  return out;
}

/**
 * 病种回退修补
 *  - code=other 且原文命中词表 → 换成真编码
 *  - code=other 且原文没有任何病名 → 丢掉（「一直在吃药」不是病）
 */
/** 疾病信号词：没有词表别名时，靠它判断「other」到底是真病还是随口一句 */
const ILLNESS_HINT = ["问题", "病", "症", "癌", "瘤", "炎", "查出", "确诊", "住院", "手术"];

function hasIllnessSignal(text: string): boolean {
  return ILLNESS_HINT.some((k) => text.includes(k));
}

export function repairOtherCodes(
  text: string,
  persons: ExtractedPerson[],
): ExtractedPerson[] {
  const codes = diseaseCodesInText(text);
  return persons
    .map((p) => ({
      ...p,
      conditions: p.conditions.filter((c) => {
        if (c.code !== "other") return true;
        // 有词表别名，或原文确实提到「问题/病/症」这类信号，就保留
        return codes.length > 0 || hasIllnessSignal(text);
      }),
    }))
    .map((p) => {
      let i = 0;
      return {
        ...p,
        conditions: p.conditions.map((c) =>
          c.code === "other" ? { ...c, code: codes[i++] ?? "other" } : c,
        ),
      };
    })
    // 按关系归并：模型可能把同一个人拆成两条（一条带具体病种、一条 other），
    // 归并后 other 才是可判断的噪声，否则逐条看都「有理」
    .reduce<ExtractedPerson[]>((acc, p) => {
      const same = acc.find((x) => x.relation === p.relation);
      if (!same) {
        acc.push({ ...p, conditions: [...p.conditions] });
        return acc;
      }
      for (const c of p.conditions) {
        if (!same.conditions.some((d) => d.code === c.code)) same.conditions.push(c);
        else if (c.onsetAge != null) {
          const dup = same.conditions.find((d) => d.code === c.code)!;
          if (dup.onsetAge == null) dup.onsetAge = c.onsetAge;
        }
      }
      return acc;
    }, [])
    .map((p) => {
      // other 是兜底码：同一个人已经有具体病种时，兜底码就是噪声
      const hasSpecific = p.conditions.some((c) => c.code !== "other");
      return hasSpecific
        ? { ...p, conditions: p.conditions.filter((c) => c.code !== "other") }
        : p;
    })
    .filter((p) => p.conditions.length > 0);
}

/**
 * 收尾归一：同一个人被拆成多条时合并，并在已有具体病种的情况下去掉兜底码 other。
 * 分段抽取的场景必须对「合并后的整组」再跑一次——每段单独看都合理，
 * 合起来才会暴露「姨妈：乳腺癌 + other」这种重复。
 */
export function finalizePersons(persons: ExtractedPerson[]): ExtractedPerson[] {
  const merged: ExtractedPerson[] = [];
  for (const p of persons) {
    const same = merged.find((x) => x.relation === p.relation);
    if (!same) {
      merged.push({ ...p, conditions: [...p.conditions] });
      continue;
    }
    for (const c of p.conditions) {
      const dup = same.conditions.find((d) => d.code === c.code);
      if (!dup) same.conditions.push(c);
      else if (dup.onsetAge == null && c.onsetAge != null) dup.onsetAge = c.onsetAge;
    }
  }
  return merged
    .map((p) =>
      p.conditions.some((c) => c.code !== "other")
        ? { ...p, conditions: p.conditions.filter((c) => c.code !== "other") }
        : p,
    )
    .filter((p) => p.conditions.length > 0);
}

/** 续句标记：「我哥也是」「父亲同样」这类继承上一句病名的句子 */
const CONTINUATION = ["也是", "同样", "也一样", "一样", "都有", "也有", "也得了"];

export function isContinuation(text: string): boolean {
  return CONTINUATION.some((k) => text.includes(k)) && relationsInText(text).length > 0;
}

/** 把上一句的病名补进续句，让它成为可抽取的完整句 */
const HEDGES = ["好像", "似乎", "可能", "大概", "听说", "估计"];

export function expandContinuation(text: string, labels: string[]): string {
  if (labels.length === 0) return text;
  let trimmed = text.replace(/[。；;！!？?]$/, "");
  // 「我爷爷好像也是」：病名在上一句已经断言过，这里的模糊词只是口头语，
  // 留着会被不确定性过滤整条丢掉（实测漏抽爷爷）
  for (const h of HEDGES) trimmed = trimmed.split(h).join("");
  return `${trimmed}${labels.join("、")}。`;
}
