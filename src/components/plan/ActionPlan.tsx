"use client";

import type { FindriscResult, ScoreKey } from "@/lib/risk/findrisc";

/**
 * 行动方案
 *
 * 设计原则（见 docs 设计稿 5.4）：
 *  1. 不是列 8 条建议让人全做，而是按「效果 ÷ 难度」排序，只留 2 件本周能做的；
 *  2. 每条必须有「最小动作」——「多运动」不会让人动，「晚饭后走 15 分钟」才会；
 *  3. 分值来自 FINDRISC 本身（做到 0 分能拿回多少），不引入未核实的外部效应量。
 */

interface Action {
  key: ScoreKey;
  /** 改什么 */
  title: string;
  /** 这周做什么（最小动作） */
  step: string;
  /** 值多少分 */
  points: number;
  /** 难度 1–3，用于排序 */
  difficulty: 1 | 2 | 3;
}

function buildActions(
  breakdown: Record<ScoreKey, number>,
  currentBmi: number,
  currentWaist: number,
  /** 腰围阈值按性别不同（男 94 cm、女 80 cm），与 findrisc.ts 的计分口径一致 */
  waistTargetCm: number,
): Action[] {
  const list: Action[] = [];

  if (breakdown.bmi > 0) {
    list.push({
      key: "bmi",
      title: `把 BMI 从 ${currentBmi.toFixed(1)} 降到 25 以下`,
      step: "晚饭主食减半，先坚持两周",
      points: breakdown.bmi,
      difficulty: 3,
    });
  }

  if (breakdown.waist > 0) {
    list.push({
      key: "waist",
      title: `把腰围从 ${currentWaist} cm 降到 ${waistTargetCm} cm 以下`,
      step: "饭后走 15 分钟，比节食更容易坚持",
      points: breakdown.waist,
      difficulty: 2,
    });
  }

  if (breakdown.physicalActivity > 0) {
    list.push({
      key: "physicalActivity",
      title: "每天活动到 30 分钟",
      step: "先从每天 10 分钟开始，一周后加到 15 分钟",
      points: breakdown.physicalActivity,
      difficulty: 1,
    });
  }

  if (breakdown.diet > 0) {
    list.push({
      key: "diet",
      title: "每天吃一份蔬菜或水果",
      step: "午饭加一份青菜，别指望晚饭补",
      points: breakdown.diet,
      difficulty: 1,
    });
  }

  // 性价比排序：每单位难度能拿回多少分
  return list.sort((a, b) => b.points / b.difficulty - a.points / a.difficulty);
}

export interface ActionPlanProps {
  result: FindriscResult;
  currentBmi: number;
  currentWaist: number;
  /** 性别决定腰围目标值（男 94 / 女 80）；默认按男性，与首页的固定示例一致 */
  sex?: "male" | "female";
}

export function ActionPlan({ result, currentBmi, currentWaist, sex = "male" }: ActionPlanProps) {
  const waistTargetCm = sex === "male" ? 94 : 80;
  const actions = buildActions(result.breakdown, currentBmi, currentWaist, waistTargetCm);

  if (actions.length === 0) {
    return (
      <section className="card">
        <p className="section-label">这周做什么</p>
        <p className="plan-done">
          这四项你都已经做到最好了，暂时没有能再拿回来的分数。
          剩下的部分来自年龄和家族史——改不了，但值得让医生知道。
        </p>
      </section>
    );
  }

  const thisWeek = actions.slice(0, 2);
  const later = actions.slice(2);
  const weekPoints = thisWeek.reduce((s, a) => s + a.points, 0);

  return (
    <section className="card">
      <p className="section-label">这周做什么</p>

      <p className="plan-lead">
        不要求你全改。只挑两件性价比最高的：<strong>做完能拿回 {weekPoints} 分</strong>
        {later.length > 0 && `，其余的等这两件稳住了再说`}。
      </p>

      <div className="plan-list">
        {thisWeek.map((a, i) => (
          <div className="plan-item" key={a.key}>
            <div className="plan-index">{i + 1}</div>
            <div className="plan-body">
              <div className="plan-title">{a.title}</div>
              <div className="plan-step">
                <span className="plan-step-label">这周</span>
                {a.step}
              </div>
            </div>
            <div className="plan-points">
              +{a.points}
              <span>分</span>
            </div>
          </div>
        ))}
      </div>

      {later.length > 0 && (
        <details className="plan-later">
          <summary>还有 {later.length} 项，等这两件稳住了再说</summary>
          <ul>
            {later.map((a) => (
              <li key={a.key}>
                {a.title}（还能拿回 {a.points} 分）
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="plan-note">
        分值来自 FINDRISC 量表本身：把对应条目做到 0 分，总分下降多少，这里就显示多少。
        方案不涉及药物，也不替代医生意见。
      </p>
    </section>
  );
}
