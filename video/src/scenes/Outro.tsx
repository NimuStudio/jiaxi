import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Frame, BrandTag } from "../components/Frame";
import { C, sec } from "../theme";

/**
 * 第四幕：收尾（20 秒）。
 *
 * 落点刻意不是「我们做了什么」，而是「它交给了你什么」——
 * 这类产品的使用者（子女）和受益者（父母）不是同一个人，
 * 所以输出必须是能递给别人的东西，而不是一个只能自己看的分数。
 */

const at = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const ITEMS = [
  {
    title: "一张家系图",
    desc: "可打印 A4，带去诊室。\n医生看一眼就懂。",
    glyph: "square" as const,
  },
  {
    title: "一份筛查时间表",
    desc: "不是「建议定期体检」，\n是「2029 年，你 35 岁」。",
    glyph: "clock" as const,
  },
  {
    title: "一份家族待办",
    desc: "「让你母亲去查一次血糖，\n她 58 岁，从未查过。」",
    glyph: "check" as const,
  },
];

function Glyph({ kind, color }: { kind: "square" | "clock" | "check"; color: string }) {
  if (kind === "square") {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56">
        <rect x={6} y={10} width={44} height={36} rx={4} fill="none" stroke={color} strokeWidth={3} />
        <line x1={6} y1={22} x2={50} y2={22} stroke={color} strokeWidth={3} />
        <rect x={22} y={30} width={12} height={12} fill={color} />
      </svg>
    );
  }
  if (kind === "clock") {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56">
        <circle cx={28} cy={28} r={21} fill="none" stroke={color} strokeWidth={3} />
        <line x1={28} y1={28} x2={28} y2={15} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <line x1={28} y1={28} x2={38} y2={32} stroke={color} strokeWidth={3} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={56} height={56} viewBox="0 0 56 56">
      <rect x={8} y={8} width={40} height={40} rx={6} fill="none" stroke={color} strokeWidth={3} />
      <path
        d="M 18 29 L 25 36 L 39 21"
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = (s: number) => sec(s);

  const titleIn = at(frame, 0, 14);
  const titleOut = at(frame, f(4.2), f(5.0));
  const closingIn = at(frame, f(14.5), f(16.5));

  return (
    <Frame>
      <BrandTag />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 180,
          textAlign: "center",
          fontSize: 62,
          fontWeight: 600,
          color: C.text,
          letterSpacing: 2,
          opacity: titleIn * (1 - titleOut),
        }}
      >
        它交给你的，不是一份报告
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 340,
          display: "flex",
          justifyContent: "center",
          gap: 34,
          padding: "0 180px",
        }}
      >
        {ITEMS.map((it, i) => {
          const s = spring({
            frame: frame - (f(5.4) + i * 7),
            fps,
            config: { damping: 16, stiffness: 105 },
          });
          return (
            <div
              key={it.title}
              style={{
                flex: 1,
                opacity: s,
                transform: `translateY(${(1 - s) * 26}px)`,
                backgroundColor: C.surface,
                border: `1px solid ${C.line}`,
                borderRadius: 22,
                padding: "40px 36px",
                boxShadow: "0 10px 32px rgba(20,24,26,0.05)",
              }}
            >
              <Glyph kind={it.glyph} color={C.primary} />
              <div style={{ fontSize: 36, fontWeight: 600, color: C.text, marginTop: 22 }}>
                {it.title}
              </div>
              <div
                style={{
                  fontSize: 26,
                  lineHeight: 1.8,
                  color: C.muted,
                  marginTop: 16,
                  whiteSpace: "pre-line",
                }}
              >
                {it.desc}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 720,
          textAlign: "center",
          opacity: closingIn,
          transform: `translateY(${(1 - closingIn) * 20}px)`,
        }}
      >
        <div style={{ fontSize: 46, lineHeight: 1.6, color: C.text, letterSpacing: 1 }}>
          这个产品的使用者，和它的受益者，是两个人。
        </div>
        <div style={{ fontSize: 26, color: C.muted, marginTop: 20, letterSpacing: 1 }}>
          所以它输出的每一样东西，都是能递给别人的。
        </div>
        <div
          style={{
            marginTop: 64,
            fontSize: 30,
            color: C.primary,
            letterSpacing: 10,
            fontWeight: 600,
          }}
        >
          家 系
        </div>
      </div>
    </Frame>
  );
}
