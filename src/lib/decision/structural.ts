/**
 * 结构特征 + 逻辑回归（本地训练的小模型）
 *
 * 权重来自 ml/train_inheritance_lr.py（15k 合成家系训练，同一批测试集 88%）。
 * 12 维特征全部从「已提到的亲属」直接数出来，不需要任何 LLM 推理，毫秒级。
 *
 * 为什么要它：决策模型单次 4.3 秒且要 18.5 GB 权重；遗传模式本来就由家系结构决定，
 * 经典遗传学就是按结构判的。有了这条路径，比赛现场没有大模型也能演示。
 *
 * 特征顺序必须与 python 脚本一致，改一处就要同步另一处。
 */

import type { ExtractedPerson } from "../extract/client.ts";
import type { HereditaryMode } from "./mode.ts";
import weights from "./structural-weights.json";

const GEN: Record<string, number> = {
  "paternal-grandfather": 0, "paternal-grandmother": 0, "maternal-grandfather": 0, "maternal-grandmother": 0,
  father: 1, mother: 1, "paternal-uncle": 1, "paternal-aunt": 1, "maternal-uncle": 1, "maternal-aunt": 1,
  self: 2, brother: 2, sister: 2, son: 3, daughter: 3,
};

function sexValue(sex: string): number {
  return sex === "male" ? 1 : sex === "female" ? 0 : 0.5;
}

export function structuralFeatures(persons: ExtractedPerson[]): number[] {
  const aff = persons.filter((p) => (p.conditions ?? []).length > 0);
  const gens = aff.map((p) => GEN[p.relation] ?? 1);
  const n = aff.length;
  const male = aff.reduce((s, p) => s + sexValue(p.sex), 0) / Math.max(1, n);
  const pat = aff.filter((p) => p.relation.startsWith("paternal") || p.relation === "father").length / 3;
  const mat = aff.filter((p) => p.relation.startsWith("maternal") || p.relation === "mother").length / 3;
  const missingAge =
    aff.filter((p) => p.conditions.every((c) => c.onsetAge == null)).length / Math.max(1, n);
  const fatherAff = persons.some((p) => p.relation === "father" && (p.conditions ?? []).length > 0);
  const sonAff = persons.some(
    (p) => (p.relation === "self" || p.relation === "brother") && p.sex === "male" && (p.conditions ?? []).length > 0,
  );

  return [
    Math.log1p(n),
    gens.length ? (Math.max(...gens) - Math.min(...gens)) / 3 : 0,
    gens.filter((g) => g === 0).length / 3,
    gens.filter((g) => g === 1).length / 3,
    gens.filter((g) => g === 2).length / 3,
    male,
    pat,
    mat,
    missingAge,
    fatherAff && sonAff ? 1 : 0,
    n === 0 ? 1 : 0,
    aff.filter((p) => p.relation === "brother" || p.relation === "sister").length / 2,
  ];
}

export interface StructuralPrediction {
  mode: HereditaryMode;
  confidence: number;
  probabilities: Record<string, number>;
}

export function structuralDecide(persons: ExtractedPerson[]): StructuralPrediction {
  const f = structuralFeatures(persons);
  // 权重由训练脚本导出，字段对不上时直接报错——静默算出 NaN 会一路传到置信度比较里
  if (f.length !== weights.mean.length || weights.W.length !== f.length) {
    throw new Error(
      `结构模型权重与特征维度不一致：features=${f.length}, mean=${weights.mean.length}, W=${weights.W.length}`,
    );
  }
  const z = weights.modes.map((_, k) =>
    f.reduce((s, x, i) => s + ((x - weights.mean[i]!) / weights.std[i]!) * weights.W[i]![k]!, weights.b[k]!),
  );
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);
  let best = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i]! > probs[best]!) best = i;
  const probabilities: Record<string, number> = {};
  weights.modes.forEach((m, i) => {
    probabilities[m] = probs[i]!;
  });
  return { mode: weights.modes[best] as HereditaryMode, confidence: probs[best]!, probabilities };
}
