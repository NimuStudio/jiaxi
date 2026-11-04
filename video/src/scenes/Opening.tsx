import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Frame, BrandTag } from "../components/Frame";
import { C, sec } from "../theme";

/**
 * 第一幕：冷开场（38 秒）。
 *
 * 叙事顺序刻意是「先给事实，再给问题，最后才给工具名」——
 * 一上来就报项目名，评委记不住任何东西；
 * 先说「你爸五十二岁放了支架，你三十一岁报告正常」，这句话本身就有钩子。
 */

const NODE_HALF = 52;

/** 整张家系图的缩放与定位：绕 (960, 600) 放大，避免图形缩在中间一小块。 */
const GRAPH_TF = "translate(960 600) scale(1.3) translate(-960 -600)";

type Sex = "male" | "female";

interface Person {
  id: string;
  x: number;
  y: number;
  sex: Sex;
  affected: boolean;
  label: string;
  at: number;
}

const PEOPLE: Person[] = [
  { id: "pgf", x: 700, y: 390, sex: "male", affected: true, label: "爷爷 · 糖尿病", at: sec(11.6) },
  { id: "pgm", x: 920, y: 390, sex: "female", affected: false, label: "奶奶", at: sec(13.2) },
  { id: "father", x: 810, y: 610, sex: "male", affected: true, label: "父亲 · 心梗 52 岁", at: sec(14.8) },
  { id: "mother", x: 1180, y: 610, sex: "female", affected: false, label: "母亲", at: sec(16.4) },
  { id: "self", x: 995, y: 820, sex: "male", affected: false, label: "你 · 31 岁", at: sec(18.0) },
];

/** 用 pathLength 归一化，配合 dashoffset 实现「一笔画出来」的效果。 */
function GrowPath({
  d,
  p,
  color = C.lineStrong,
  w = 3,
}: {
  d: string;
  p: number;
  color?: string;
  w?: number;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1 - p}
    />
  );
}

const at = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

function PersonNode({ person, frame, fps }: { person: Person; frame: number; fps: number }) {
  const s = spring({
    frame: frame - person.at,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });
  const opacity = at(frame, person.at, person.at + 8);
  const fill = person.affected ? C.primary : C.surface;
  const stroke = person.affected ? C.primary : C.lineStrong;

  return (
    <g transform={`translate(${person.x} ${person.y}) scale(${s})`} opacity={opacity}>
      {person.sex === "male" ? (
        <rect
          x={-NODE_HALF}
          y={-NODE_HALF}
          width={NODE_HALF * 2}
          height={NODE_HALF * 2}
          rx={6}
          fill={fill}
          stroke={stroke}
          strokeWidth={3}
        />
      ) : (
        <circle r={NODE_HALF} fill={fill} stroke={stroke} strokeWidth={3} />
      )}
      <text
        x={0}
        y={NODE_HALF + 44}
        textAnchor="middle"
        fontSize={28}
        fill={person.affected ? C.primary : C.muted}
        fontWeight={person.affected ? 600 : 400}
      >
        {person.label}
      </text>
    </g>
  );
}

function Caption({
  text,
  frame,
  from,
  to,
  size = 60,
  top = 400,
  weight = 400,
}: {
  text: string;
  frame: number;
  from: number;
  to: number;
  size?: number;
  top?: number;
  weight?: number;
}) {
  const inP = at(frame, from, from + 14);
  const outP = at(frame, to - 14, to);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        textAlign: "center",
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.5,
        color: C.text,
        letterSpacing: 1,
        opacity: inP * (1 - outP),
        transform: `translateY(${(1 - inP) * 18}px)`,
      }}
    >
      {text}
    </div>
  );
}

export function Opening() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 结尾：图完全退场（留一点点会与标题叠成噪点，不如干脆退干净），标题进入
  const graphDim = interpolate(frame, [sec(30.6), sec(32.4)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const graphScale = interpolate(frame, [sec(30.6), sec(32.4)], [1, 0.94], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleIn = interpolate(frame, [sec(31.4), sec(33.4)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Frame>
      <BrandTag />

      {/* 前半段：三句字幕，此时家系图还未出现 */}
      <Caption text="你爸五十二岁那年，放了心脏支架。" frame={frame} from={sec(0.4)} to={sec(4.2)} top={440} />
      <Caption text="你今年三十一，体检报告写着「未见异常」。" frame={frame} from={sec(4.4)} to={sec(8.2)} top={440} />
      <Caption
        text="这两句话之间，隔着二十一年。"
        frame={frame}
        from={sec(8.4)}
        to={sec(11.4)}
        top={440}
        weight={600}
      />

      <svg
        width={1920}
        height={1080}
        style={{
          position: "absolute",
          inset: 0,
          opacity: graphDim,
          transform: `scale(${graphScale})`,
          transformOrigin: "960px 600px",
        }}
      >
        <g transform={GRAPH_TF}>
          <GrowPath d="M 752 390 L 868 390" p={at(frame, sec(12.4), sec(13.2))} />
          <GrowPath d="M 810 390 L 810 558" p={at(frame, sec(15.4), sec(16.2))} />
          <GrowPath d="M 862 610 L 1128 610" p={at(frame, sec(17.0), sec(17.8))} />
          <GrowPath d="M 995 610 L 995 768" p={at(frame, sec(18.6), sec(19.4))} />

          {PEOPLE.map((p) => (
            <PersonNode key={p.id} person={p} frame={frame} fps={fps} />
          ))}
        </g>
      </svg>

      <Caption
        text="图上真正有信息量的，不是「谁病了」。"
        frame={frame}
        from={sec(24.5)}
        to={sec(27.4)}
        size={50}
        top={110}
      />
      <Caption
        text="是几岁发病、几个亲属、哪一侧。"
        frame={frame}
        from={sec(27.6)}
        to={sec(30.4)}
        size={50}
        top={110}
        weight={600}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 380,
          textAlign: "center",
          opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * 24}px)`,
        }}
      >
        <div style={{ fontSize: 150, fontWeight: 700, color: C.primary, letterSpacing: 16 }}>家系</div>
        <div style={{ fontSize: 40, color: C.muted, marginTop: 26, letterSpacing: 2 }}>
          把一家人的病史，变成一张能带去诊室的纸
        </div>
      </div>
    </Frame>
  );
}
