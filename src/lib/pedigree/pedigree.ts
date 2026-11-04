/**
 * 家系血缘查询工具
 *
 * 这些函数是「筛查规则引擎」的积木：规则不直接遍历树，而是调用这些
 * 可单测的纯函数（谁、几岁发病、几个亲属）。这样每一条筛查规则都能被
 * 精确验证，而不是藏在条件判断里。
 */
import type { Age, Degree, FamilyTree, Person, RelationType } from "./types";

export const DEGREE_OF_RELATION: Record<RelationType, Degree> = {
  self: 0,
  father: 1,
  mother: 1,
  son: 1,
  daughter: 1,
  brother: 1,
  sister: 1,
  "paternal-grandfather": 2,
  "paternal-grandmother": 2,
  "maternal-grandfather": 2,
  "maternal-grandmother": 2,
  "paternal-uncle": 2,
  "paternal-aunt": 2,
  "maternal-uncle": 2,
  "maternal-aunt": 2,
  spouse: 0, // 配偶非血缘，不算亲缘等级
  unknown: 3,
};

export function degreeOf(person: Person): Degree {
  return DEGREE_OF_RELATION[person.relation] ?? 3;
}

/** 返回指定亲缘等级的所有亲属（不含本人和配偶）。 */
export function relativesOfDegree(tree: FamilyTree, degree: Degree): Person[] {
  return Object.values(tree.persons).filter(
    (p) => p.id !== tree.probandId && degreeOf(p) === degree,
  );
}

export function firstDegreeRelatives(tree: FamilyTree): Person[] {
  return relativesOfDegree(tree, 1);
}

export function secondDegreeRelatives(tree: FamilyTree): Person[] {
  return relativesOfDegree(tree, 2);
}

/** 指定疾病编码的患病亲属（限定亲缘等级）。 */
export function affectedRelatives(
  tree: FamilyTree,
  diseaseCode: string,
  degree: Degree,
): Person[] {
  return relativesOfDegree(tree, degree).filter((p) =>
    p.conditions.some((c) => c.code === diseaseCode),
  );
}

/** 患病亲属数量。 */
export function affectedCount(
  tree: FamilyTree,
  diseaseCode: string,
  degree: Degree,
): number {
  return affectedRelatives(tree, diseaseCode, degree).length;
}

/**
 * 最早的发病年龄（限定亲缘等级）。没有记录时返回 null。
 * 注意：只有带发病年龄的患病记录才参与比较，缺年龄的不猜。
 */
export function earliestOnsetAge(
  tree: FamilyTree,
  diseaseCode: string,
  degree: Degree,
): Age | null {
  const onsets = affectedRelatives(tree, diseaseCode, degree)
    .flatMap((p) => p.conditions)
    .filter((c) => c.code === diseaseCode && c.onsetAge !== undefined)
    .map((c) => c.onsetAge as Age);

  if (onsets.length === 0) return null;
  return onsets.reduce((min, a) => (a.value < min.value ? a : min));
}

export interface FamilyHistorySummary {
  /** 该病种是否有家族史（任一血缘亲属患病） */
  hasHistory: boolean;
  /** 一级亲属患病人数 */
  firstDegreeCount: number;
  /** 二级亲属患病人数 */
  secondDegreeCount: number;
  /** 一级亲属最早发病年龄 */
  earliestFirstDegreeOnset: Age | null;
}

/** 汇总某个病种的家族史三要素（谁、几个、几岁）。 */
export function summarizeFamilyHistory(
  tree: FamilyTree,
  diseaseCode: string,
): FamilyHistorySummary {
  const first = affectedRelatives(tree, diseaseCode, 1);
  const second = affectedRelatives(tree, diseaseCode, 2);
  return {
    hasHistory: first.length + second.length > 0,
    firstDegreeCount: first.length,
    secondDegreeCount: second.length,
    earliestFirstDegreeOnset: earliestOnsetAge(tree, diseaseCode, 1),
  };
}
