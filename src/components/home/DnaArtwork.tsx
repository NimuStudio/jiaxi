/**
 * 登录页的 DNA 插图（SVG）。
 *
 * 为什么从 canvas 换成 SVG：canvas 版反复调参后仍会在大屏上出现"杂线"
 * （远侧链段与碱基对在投影里互相穿插，视觉上是一层蛛网）。
 * SVG 版本是**离屏算好的几何**：每个点只画一次、正反面按 z 显式排序，
 * 不会出现意外的穿插线；同时矢量在任意分辨率都清晰，也没有逐帧绘制开销。
 *
 * 动效：碱基对的亮度按索引做缓慢波动（CSS animation-delay 错开），
 * 看起来像信号沿螺旋流动。尊重 prefers-reduced-motion。
 */

const CX = 260;
const TOP = 40;
const H = 540;
const RX = 128; // 横向半径
const RY = 26; // 纵向"厚度"（让螺旋有俯视角）
const TURNS = 3;
const RUNGS = 46;

type Pt = { x: number; y: number; z: number };

function build() {
  const a: Pt[] = [];
  const b: Pt[] = [];
  const step = 220;
  for (let i = 0; i <= step; i++) {
    const t = (i / step) * Math.PI * 2 * TURNS;
    const y = TOP + (H * i) / step;
    for (const [arr, phase] of [[a, 0], [b, Math.PI]] as const) {
      const x = CX + Math.cos(t + phase) * RX;
      const z = Math.sin(t + phase); // -1..1，+1 表示面向读者
      // 用 z 把 y 稍微推一点，形成俯视的椭圆轨迹
      arr.push({ x, y: y + z * RY * 0.16, z });
    }
  }
  return { a, b, step };
}

const { a, b } = build();

const strandPath = (pts: Pt[]) =>
  pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");

/** 碱基对：只在需要的位置取点，长度随两条链的横向距离变化（天然近短远长） */
const rungs = Array.from({ length: RUNGS }, (_, k) => {
  const idx = Math.round((k / (RUNGS - 1)) * (a.length - 1));
  const pa = a[idx];
  const pb = b[idx];
  if (!pa || !pb) return null;
  const depth = (pa.z + pb.z) / 2; // -1..1，越大越靠前
  const front = depth > -0.15;
  return {
    x1: pa.x,
    y1: pa.y,
    x2: pb.x,
    y2: pb.y,
    depth,
    front,
    delay: (k % 12) * 0.26,
  };
}).filter((r): r is NonNullable<typeof r> => r !== null);

export function DnaArtwork() {
  return (
    <svg
      className="dna-art"
      viewBox="0 0 520 620"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="dnaA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6fb0" stopOpacity="0.25" />
          <stop offset="35%" stopColor="#2f6fb0" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#1a6fb5" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1a6fb5" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="dnaB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#178f9b" stopOpacity="0.2" />
          <stop offset="40%" stopColor="#178f9b" stopOpacity="0.9" />
          <stop offset="75%" stopColor="#0f7c8c" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0f7c8c" stopOpacity="0.15" />
        </linearGradient>
        <filter id="dnaBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="dnaGlow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#d6e8f8" stopOpacity="0.85" />
          <stop offset="65%" stopColor="#e8f2fb" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx={CX} cy={TOP + H / 2} rx={230} ry={330} fill="url(#dnaGlow)" />

      {/* 背侧碱基对：极淡，只用于暗示纵深 */}
      <g opacity="0.16">
        {rungs
          .filter((r) => !r.front)
          .map((r, i) => (
            <line
              key={`b${i}`}
              x1={r.x1}
              y1={r.y1}
              x2={r.x2}
              y2={r.y2}
              stroke="#7ea8c9"
              strokeWidth="0.8"
            />
          ))}
      </g>

      {/* 辉光层：同一条路径放大加模糊，作为背景光晕（比单纯描边更有质感） */}
      <g filter="url(#dnaBlur)" opacity="0.55">
        <path d={strandPath(a)} fill="none" stroke="#5b9ed6" strokeWidth="6" />
        <path d={strandPath(b)} fill="none" stroke="#3fb3bd" strokeWidth="6" />
      </g>

      {/* 两条主链 */}
      <path d={strandPath(a)} fill="none" stroke="url(#dnaA)" strokeWidth="2.6" strokeLinecap="round" />
      <path d={strandPath(b)} fill="none" stroke="url(#dnaB)" strokeWidth="2.6" strokeLinecap="round" />

      {/* 高光芯线：1px 白线叠在链上，模拟光照，屏幕小也不会糊 */}
      <path d={strandPath(a)} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.7" />
      <path d={strandPath(b)} fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.7" />

      {/* 前侧碱基对：带"信号流动"的呼吸动画 */}
      <g>
        {rungs
          .filter((r) => r.front)
          .map((r, i) => {
            const op = 0.22 + Math.max(0, r.depth) * 0.62;
            return (
              <line
                key={`f${i}`}
                x1={r.x1}
                y1={r.y1}
                x2={r.x2}
                y2={r.y2}
                stroke="#4a8fc4"
                strokeWidth={0.9 + Math.max(0, r.depth) * 0.9}
                strokeOpacity={op}
                className="dna-rung"
                style={{ animationDelay: `${r.delay}s` }}
              />
            );
          })}
      </g>

      {/* 少量高光点：只在最靠前的几个位置点缀，避免连成一串珠子 */}
      <g>
        {a.concat(b).map((p, i) =>
          p.z > 0.86 ? (
            <circle key={`n${i}`} cx={p.x} cy={p.y} r={1.4} fill="#2f6fb0" opacity={0.5} />
          ) : null,
        )}
      </g>
    </svg>
  );
}
