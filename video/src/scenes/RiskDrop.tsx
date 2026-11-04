import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { Frame, BrandTag } from "../components/Frame";
import { C, sec } from "../theme";

/**
 * 第三幕：可回收风险（50 秒）。
 *
 * 数字全部来自 src/lib/risk/findrisc.ts 的真实计算，与网页上完全一致：
 *   基线 16 分 → 33%（高风险）
 *   可回收 7 分（BMI 1 + 腰围 3 + 活动 2 + 蔬果 1）
 *   全部达标 9 分 → 4%
 *
 * 这一幕的核心不是「展示一个数字」，而是让观众看见橙色段被一点点吃掉——
 * 用户能拿回来的那部分，是他自己拖下去的，不是产品告诉他的。
 */

const X0 = 300;
const X1 = 1620;
const AXIS_Y = 560;
const MIN_R = 1;
const MAX_R = 50;

/** 对数刻度：1%–50% 线性铺开会把低风险区压成一条线。 */
function pos(risk: number): number {
  const r = Math.min(Math.max(risk, MIN_R), MAX_R);
  return Math.log(r / MIN_R) / Math.log(MAX_R / MIN_R);
}
const xOf = (risk: number) => X0 + (X1 - X0) * pos(risk);

/** 分档到 10 年风险，与 findrisc.ts 的 bandOf / bandRisk 一致。 */
function riskOfScore(score: number): number {
  if (score <= 6) return 1;
  if (score <= 11) return 4;
  if (score <= 14) return 17;
  if (score <= 20) return 33;
  return 50;
}

const at = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const TICKS = [1, 4, 17, 33, 50];

interface Factor {
  name: string;
  now: string;
  goal: string;
  points: number;
  /** 该项改善在总进度中的起止区间 */
  span: [number, number];
}

const FACTORS: Factor[] = [
  { name: "体质指数", now: "27.3", goal: "24.0", points: 1, span: [0.0, 0.22] },
  { name: "腰围（cm）", now: "96", goal: "88", points: 3, span: [0.22, 0.6] },
  { name: "每周活动", now: "否", goal: "是", points: 2, span: [0.6, 0.82] },
  { name: "每天蔬果", now: "否", goal: "是", points: 1, span: [0.82, 1.0] },
];

export function RiskDrop() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = (s: number) => sec(s);

  // 各项改善的进度（0→1），错开进行，让分数一格一格掉
  const p = at(frame, f(24), f(38));
  const progresses = FACTORS.map((fa) =>
    interpolate(p, [fa.span[0], fa.span[1]], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // 每项分数按各自进度取整，总分才会出现「一格一格」的跳变
  const remaining = FACTORS.map((fa, i) => Math.round(fa.points * (1 - (progresses[i] ?? 0))));
  const score = 9 + remaining.reduce((a, b) => a + b, 0); // 9 分是不可改变部分
  const risk = riskOfScore(score);

  // 橙色区间 = 从「全部达标后的 4%」到「当前值」。
  // 随着用户改善，当前值向 4% 靠拢，这段橙色就被吃掉——这正是「可回收」的可视化。
  const goalX = xOf(4);
  const curX = xOf(risk);
  const bandW = Math.max(0, curX - goalX);

  const axisIn = at(frame, f(5), f(8));
  const bandIn = at(frame, f(9), f(12));
  const bandOpacity = bandIn * interpolate(bandW, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const numIn = at(frame, f(6), f(9));
  const captionIn = at(frame, f(40), f(43));

  return (
    <Frame>
      <BrandTag />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 130,
          textAlign: "center",
          fontSize: 46,
          color: C.text,
          letterSpacing: 2,
          opacity: at(frame, f(2), f(5)),
        }}
      >
        你的风险里，有多少能拿回来
      </div>

      {/* 大数字 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 218,
          textAlign: "center",
          opacity: numIn,
        }}
      >
        <span
          style={{
            fontSize: 150,
            fontWeight: 700,
            color: risk <= 11 ? C.primary : C.reclaim,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {risk}%
        </span>
        <div style={{ fontSize: 28, color: C.muted, marginTop: 18, letterSpacing: 1 }}>
          未来 10 年 2 型糖尿病风险 · FINDRISC {score} 分
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {/* 轴 */}
        <line
          x1={X0}
          y1={AXIS_Y}
          x2={X0 + (X1 - X0) * axisIn}
          y2={AXIS_Y}
          stroke={C.lineStrong}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* 可回收区间：从「当前」到「起点」，随改善收缩 */}
        {bandOpacity > 0.01 && (
          <g opacity={bandOpacity}>
            <rect
              x={goalX}
              y={AXIS_Y - 16}
              width={bandW}
              height={32}
              rx={16}
              fill={C.reclaimSoft}
              stroke={C.reclaimLine}
              strokeWidth={2}
            />
          </g>
        )}

        {/* 刻度 */}
        {TICKS.map((t) => {
          const x = xOf(t);
          const tickIn = at(frame, f(6) + (pos(t) * 10), f(7.4) + pos(t) * 10);
          return (
            <g key={t} opacity={tickIn}>
              <line x1={x} y1={AXIS_Y - 10} x2={x} y2={AXIS_Y + 10} stroke={C.line} strokeWidth={2} />
              <text
                x={x}
                y={AXIS_Y + 52}
                textAnchor="middle"
                fontSize={26}
                fill={C.faint}
                fontFamily="inherit"
              >
                {t}%
              </text>
            </g>
          );
        })}

        {/* 当前值标记 */}
        <g opacity={numIn}>
          <circle cx={curX} cy={AXIS_Y} r={13} fill={risk <= 11 ? C.primary : C.reclaim} />
          <line
            x1={curX}
            y1={AXIS_Y - 92}
            x2={curX}
            y2={AXIS_Y - 14}
            stroke={risk <= 11 ? C.primary : C.reclaim}
            strokeWidth={2}
            strokeDasharray="6 6"
            opacity={0.5}
          />
        </g>
      </svg>

      {/* 四项因素卡片 */}
      <div
        style={{
          position: "absolute",
          left: X0,
          right: 1920 - X1,
          top: 690,
          display: "flex",
          gap: 22,
        }}
      >
        {FACTORS.map((fa, i) => {
          const s = spring({
            frame: frame - (f(12) + i * 6),
            fps,
            config: { damping: 16, stiffness: 110 },
          });
          const pr = progresses[i] ?? 0;
          const done = pr > 0.98;
          return (
            <div
              key={fa.name}
              style={{
                flex: 1,
                opacity: s,
                transform: `translateY(${(1 - s) * 16}px)`,
                backgroundColor: done ? C.primarySoft : C.surface,
                border: `1px solid ${done ? "#cfe3da" : C.line}`,
                borderRadius: 18,
                padding: "24px 26px",
              }}
            >
              <div style={{ fontSize: 26, color: C.muted, marginBottom: 14 }}>{fa.name}</div>
              <div style={{ fontSize: 37, color: C.text, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {fa.now}
                <span style={{ color: C.faint, fontSize: 30, margin: "0 10px" }}>→</span>
                <span style={{ color: done ? C.primary : C.muted, fontWeight: done ? 600 : 400 }}>
                  {fa.goal}
                </span>
              </div>
              <div
                style={{
                  fontSize: 25,
                  color: C.reclaim,
                  marginTop: 12,
                  opacity: 1 - pr,
                }}
              >
                可回收 {fa.points} 分
              </div>
            </div>
          );
        })}
      </div>

      {/* 结论 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 900,
          textAlign: "center",
          fontSize: 52,
          fontWeight: 600,
          color: C.text,
          letterSpacing: 1,
          opacity: captionIn,
          transform: `translateY(${(1 - captionIn) * 18}px)`,
        }}
      >
        从 33% 到 4%。
        <span style={{ color: C.reclaim }}>这 7 分，是你自己的。</span>
      </div>
    </Frame>
  );
}
