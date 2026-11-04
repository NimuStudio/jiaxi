"use client";

/**
 * 风险刻度尺
 *
 * 用对数刻度把 0.1%–50% 的 10 年风险摊开，否则低风险区间会被压成一条线。
 * 两个标记点分别是「现在」和「全部达标后」，中间的橙色虚线就是可回收区间。
 */

const MIN_RISK = 0.1;
const MAX_RISK = 50;

function position(risk: number): number {
  const clamped = Math.min(Math.max(risk, MIN_RISK), MAX_RISK);
  return (Math.log(clamped / MIN_RISK) / Math.log(MAX_RISK / MIN_RISK)) * 100;
}

const TICKS = [
  { value: 0.3, label: "0.3%" },
  { value: 2.6, label: "2.6%" },
  { value: 23.1, label: "23.1%" },
];

export interface RiskScaleProps {
  /** 现在的 10 年风险（%） */
  now: number;
  /** 全部达标后的 10 年风险（%） */
  goal: number;
}

export function RiskScale({ now, goal }: RiskScaleProps) {
  const nowPos = position(now);
  const goalPos = position(goal);
  const left = Math.min(nowPos, goalPos);
  const width = Math.abs(nowPos - goalPos);
  const sameSpot = Math.abs(nowPos - goalPos) < 0.5;

  return (
    <div className="scale" role="img" aria-label={`风险从 ${now}% 降到 ${goal}%`}>
      <div className="scale-track" />

      {!sameSpot && (
        <div
          className="scale-reclaim"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      )}

      <div className="scale-marker goal" style={{ left: `${goalPos}%` }} />
      {!sameSpot && (
        <div className="scale-marker now" style={{ left: `${nowPos}%` }} />
      )}

      {TICKS.map((t) => (
        <span
          key={t.value}
          className="scale-tick"
          style={{ left: `${position(t.value)}%` }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}
