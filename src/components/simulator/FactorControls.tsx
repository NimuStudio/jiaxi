"use client";

import type { ScoreKey } from "@/lib/risk/findrisc";

/**
 * 因素面板：左边是可改变的（能拖），右边是改不了的（只能看）。
 * 「改不了」这一栏故意放在旁边，而不是藏起来——它同时说明了两件事：
 * 风险是真的，以及哪些部分不该由用户自责。
 */

export interface Factors {
  bmi: number;
  waistCm: number;
  physicallyActive: boolean;
  eatsVegetablesDaily: boolean;
}

export interface FactorControlsProps {
  factors: Factors;
  onChange: (patch: Partial<Factors>) => void;
  breakdown: Record<ScoreKey, number>;
}

export function FactorControls({
  factors,
  onChange,
  breakdown,
}: FactorControlsProps) {
  const bmiScore = breakdown.bmi ?? 0;
  const waistScore = breakdown.waist ?? 0;
  const activityScore = breakdown.physicalActivity ?? 0;
  const dietScore = breakdown.diet ?? 0;

  return (
    <div className="factors">
      <div>
        <h3 className="factor-group-title">可以改变的因素</h3>
        <p className="factor-group-hint">拖动看看，右边的数字会跟着变</p>

        <div className="factor">
          <div className="factor-row">
            <span className="name">体质指数 BMI</span>
            <span className={`val${bmiScore > 0 ? " hot" : ""}`}>
              {factors.bmi.toFixed(1)} · {bmiScore} 分
            </span>
          </div>
          <input
            type="range"
            min={19}
            max={35}
            step={0.5}
            value={factors.bmi}
            aria-label="体质指数 BMI"
            onChange={(e) => onChange({ bmi: Number(e.target.value) })}
          />
        </div>

        <div className="factor">
          <div className="factor-row">
            <span className="name">腰围</span>
            <span className={`val${waistScore > 0 ? " hot" : ""}`}>
              {factors.waistCm} cm · {waistScore} 分
            </span>
          </div>
          <input
            type="range"
            min={70}
            max={115}
            step={1}
            value={factors.waistCm}
            aria-label="腰围（厘米）"
            onChange={(e) => onChange({ waistCm: Number(e.target.value) })}
          />
        </div>

        <div className="toggle-row">
          <span className="name">每天活动 30 分钟</span>
          <button
            type="button"
            className="toggle-btn"
            data-on={String(factors.physicallyActive)}
            onClick={() =>
              onChange({ physicallyActive: !factors.physicallyActive })
            }
          >
            {factors.physicallyActive ? "做到" : "没做到"}
          </button>
        </div>

        <div className="toggle-row">
          <span className="name">每天吃蔬菜水果</span>
          <button
            type="button"
            className="toggle-btn"
            data-on={String(factors.eatsVegetablesDaily)}
            onClick={() =>
              onChange({ eatsVegetablesDaily: !factors.eatsVegetablesDaily })
            }
          >
            {factors.eatsVegetablesDaily ? "做到" : "没做到"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="factor-group-title">改不了的因素</h3>
        <p className="factor-group-hint">这些不怪你，但必须算进去</p>

        <div className="fixed-item">
          <span>年龄</span>
          <span className="fixed-val">48 岁</span>
        </div>
        <div className="fixed-item">
          <span>性别</span>
          <span className="fixed-val">男</span>
        </div>
        <div className="fixed-item">
          <span>家族史</span>
          <span className="fixed-val">母亲糖尿病 · 一级亲属</span>
        </div>
        <div className="fixed-item">
          <span>服用降压药</span>
          <span className="fixed-val">是</span>
        </div>
        <div className="fixed-item">
          <span>曾发现血糖偏高</span>
          <span className="fixed-val">否</span>
        </div>

        <p className="fixed-note">
          家族史这一项来自家系图：母亲 58 岁确诊糖尿病，作为一级亲属计入 5 分。
          这一项在 FINDRISC 里权重最高，也是最不该被忽略的一项。
        </p>
      </div>
    </div>
  );
}
