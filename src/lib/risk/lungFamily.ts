import type { ExtractedPerson } from "@/lib/extract/client";

/**
 * 从家系里读「肺癌家族史」，给 PLCOm2012 用。
 *
 * 模型里的 family history of lung cancer 指的是**一级亲属**（父母、兄弟姊妹、子女）。
 * 二级亲属（祖父母、叔姑舅姨）有肺癌时不算阳性，但要在界面上说明「为什么没勾」，
 * 否则用户会以为家系没被读进去。
 */

/** 一级亲属：与 China-PAR 的判定不同，这里含子女 */
export const FIRST_DEGREE_RELATIONS = new Set([
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
]);

/** 兼容历史数据：早期抽取结果里病名是中文，词表统一后是 lung-cancer */
const LUNG_CODES = new Set(["lung-cancer", "肺癌"]);

export function hasLungCancer(p: ExtractedPerson): boolean {
  return p.conditions.some((c) => LUNG_CODES.has(c.code));
}

export interface LungFamilyRead {
  /** 一级亲属是否有肺癌（决定是否自动勾选） */
  firstDegree: ExtractedPerson | null;
  /** 只有二级亲属有时，取第一位用于提示 */
  secondDegree: ExtractedPerson | null;
}

export function readLungFamilyHistory(persons: ExtractedPerson[]): LungFamilyRead {
  const firstDegree = persons.find((p) => FIRST_DEGREE_RELATIONS.has(p.relation) && hasLungCancer(p)) ?? null;
  if (firstDegree) return { firstDegree, secondDegree: null };
  const secondDegree =
    persons.find((p) => p.relation !== "self" && !FIRST_DEGREE_RELATIONS.has(p.relation) && hasLungCancer(p)) ?? null;
  return { firstDegree: null, secondDegree };
}

/** 吸烟史自洽性：从 10 岁起算，吸烟年限 + 戒烟年数不能超过年龄容纳的上限 */
export function smokingSpanError(age: number, smokingYears: number, quitYears: number): string | null {
  if (!Number.isFinite(age) || !Number.isFinite(smokingYears) || !Number.isFinite(quitYears)) return null;
  if (smokingYears + quitYears > age - 10) {
    return "吸烟年限 + 戒烟年数超过年龄能容纳的上限（按 10 岁开始吸烟算）";
  }
  return null;
}
