import type { RiskFactors } from "@/lib/agent/tools";

/**
 * 体检数字的唯一校验入口。
 *
 * 之前 /api/me/factors 与 /api/agent 各写一套：前者要求布尔字段严格存在，
 * 后者用 Boolean(x) 把「缺失」变成 false —— 于是同一份数据在两个入口得到不同风险，
 * 而且缺失字段会被静默当作「不运动 / 不吃蔬菜 / 有高血压」直接加分。
 * 另外两处都没有生理值域：age=1 或 bmi=5 也能算出「带出处的低风险分」。
 */
export const FACTOR_BOUNDS = {
  age: [18, 120],
  bmi: [10, 60],
  waistCm: [40, 200],
} as const;

const BOOL_KEYS = [
  "physicallyActive",
  "eatsVegetablesDaily",
  "onAntihypertensive",
  "historyOfHighGlucose",
] as const;

function inRange(v: unknown, [min, max]: readonly [number, number]): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

/** 校验通过返回规范化后的对象；任何一项不合法返回 null（调用方决定 400 还是丢弃） */
export function parseRiskFactors(input: unknown): RiskFactors | null {
  if (!input || typeof input !== "object") return null;
  const f = input as Record<string, unknown>;

  if (!inRange(f.age, FACTOR_BOUNDS.age)) return null;
  if (!inRange(f.bmi, FACTOR_BOUNDS.bmi)) return null;
  if (!inRange(f.waistCm, FACTOR_BOUNDS.waistCm)) return null;
  if (f.sex !== "male" && f.sex !== "female") return null;

  for (const k of BOOL_KEYS) {
    if (typeof f[k] !== "boolean") return null;
  }

  // 生活方式暴露是后加的，缺省按 false 兼容老数据
  const exposure = (v: unknown) => (typeof v === "boolean" ? v : false);

  return {
    age: Math.round(f.age),
    sex: f.sex,
    bmi: Math.round(f.bmi * 10) / 10,
    waistCm: Math.round(f.waistCm),
    physicallyActive: f.physicallyActive as boolean,
    eatsVegetablesDaily: f.eatsVegetablesDaily as boolean,
    onAntihypertensive: f.onAntihypertensive as boolean,
    historyOfHighGlucose: f.historyOfHighGlucose as boolean,
    smoker: exposure(f.smoker),
    drinker: exposure(f.drinker),
    lungDisease: exposure(f.lungDisease),
  };
}
