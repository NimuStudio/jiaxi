"use client";

import { useMemo, useState } from "react";
import { evaluateFindrisc, type RiskBand } from "@/lib/risk/findrisc";
import { ActionPlan } from "@/components/plan/ActionPlan";
import { RiskScale } from "./RiskScale";
import { FactorControls, type Factors } from "./FactorControls";
import { useCountUp } from "@/components/ui/useCountUp";

const BAND_LABEL: Record<RiskBand, string> = {
  low: "低",
  "slightly-elevated": "轻度升高",
  moderate: "中等",
  high: "高",
  "very-high": "极高",
};

/** 初始案例：48 岁男性，母亲 58 岁确诊糖尿病，生活方式一般。 */
const INITIAL: Factors = {
  bmi: 27,
  waistCm: 96,
  physicallyActive: false,
  eatsVegetablesDaily: false,
};

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function ReclaimSimulator() {
  const [factors, setFactors] = useState<Factors>(INITIAL);

  const result = useMemo(
    () =>
      evaluateFindrisc({
        age: 48,
        bmi: factors.bmi,
        waistCm: factors.waistCm,
        sex: "male",
        physicallyActive: factors.physicallyActive,
        eatsVegetablesDaily: factors.eatsVegetablesDaily,
        onAntihypertensive: true,
        historyOfHighGlucose: false,
        familyHistory: "first",
      }),
    [factors],
  );

  const now = result.current.tenYearRiskPercent;
  const goal = result.best.tenYearRiskPercent;
  // 关键数字滚动：拖滑块时看得见风险在动，而不是瞬间跳变
  const nowAnim = useCountUp(now, 500);
  const goalAnim = useCountUp(goal, 500);
  const reclaimable = result.reclaimablePoints;
  // 颜色承载语义：低危 / 中危 / 高危 三档分开，避免高危与中危共用同一个颜色
  const bandTone =
    result.current.band === "low"
      ? "is-low"
      : result.current.band === "slightly-elevated" || result.current.band === "moderate"
        ? "is-mid"
        : "is-high";

  return (
    <>
      <section className="card">
        <p className="section-label">未来 10 年 2 型糖尿病风险</p>

        <div className="risk-headline">
          <span className={`risk-big ${bandTone}`}>
            {fmtPct(nowAnim)}
            <span className="risk-unit">%</span>
          </span>
          <span className={`band-chip ${bandTone}`}>
            {BAND_LABEL[result.current.band]}
          </span>
          {/*
            这里刻意不写「你是平均水平的 X 倍」。
            FINDRISC 是分档评分工具，没有「个人风险 / 人群基线」这个比值；
            1–3 分与 23.1% 只是不同分档的参考值，拿来做除法会造出一个假的倍数。
            倍数只有等接上 China-PAR（有明确人群基线）时才成立。
          */}
          <span className="risk-caption">
            FINDRISC 总分 {result.score} 分 · 高风险区间为 15–20 分
          </span>
        </div>

        <div className="compare">
          <div className="compare-item now">
            <div className="value">{fmtPct(nowAnim)}%</div>
            <div className="label">现在</div>
          </div>
          <div className="compare-arrow">
            <strong>{reclaimable > 0 ? `${reclaimable} 分` : "—"}</strong>
            可回收
          </div>
          <div className="compare-item goal">
            <div className="value">{fmtPct(goalAnim)}%</div>
            <div className="label">全部达标后</div>
          </div>
        </div>

        <RiskScale now={now} goal={goal} />

        <div className={`verdict${reclaimable === 0 ? " is-done" : ""}`}>
          {reclaimable > 0 ? (
            <>
              这 <strong>{reclaimable} 分</strong>
              来自 BMI、腰围、体力活动和蔬果摄入——都是能改的。
              剩下的 {result.bestAchievableScore} 分来自年龄、家族史和正在服用的降压药，改不了，也不该由你自责。
            </>
          ) : (
            <>
              你已经把这四项都做到最好了。<strong>剩下的分数来自年龄、家族史和降压药</strong>
              ，这部分改不了，但值得让医生知道。
            </>
          )}
        </div>
      </section>

      <section className="card">
        <p className="section-label">风险从哪来</p>
        <FactorControls
          factors={factors}
          breakdown={result.breakdown}
          onChange={(patch) =>
            setFactors((prev) => ({ ...prev, ...patch }))
          }
        />
      </section>

      <ActionPlan
        result={result}
        currentBmi={factors.bmi}
        currentWaist={factors.waistCm}
      />
    </>
  );
}
