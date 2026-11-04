import { useCurrentFrame, interpolate } from "remotion";
import type { ReactNode } from "react";
import { Frame, BrandTag } from "../components/Frame";
import { C, MONO, sec } from "../theme";

/**
 * 第二幕：AI 技术链路（62 秒）。
 *
 * 这一幕承担评分表里「AI 技术深度 35%」的展示任务，所以不能只放界面截图，
 * 必须把「模型负责什么、规则负责什么、为什么这样分工」讲出来。
 *
 * 五个环节全部对应代码里真实存在的处理步骤，数字取自真实评测结果。
 */

const STEPS = [
  { label: "输入", from: 2.5, to: 14 },
  { label: "分句", from: 14, to: 25 },
  { label: "约束解码", from: 25, to: 37 },
  { label: "词表校正", from: 37, to: 48 },
  { label: "证据校验", from: 48, to: 62 },
] as const;

const at = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 只在 [from,to) 区间内显示的内容块。 */
function Beat({
  frame,
  from,
  to,
  children,
}: {
  frame: number;
  from: number;
  to: number;
  children: ReactNode;
}) {
  const inP = at(frame, from, from + 10);
  const outP = at(frame, to - 8, to);
  const o = inP * (1 - outP);
  if (o <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: o,
        transform: `translateY(${(1 - inP) * 16}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 200,
        top: 330,
        width: 1520,
        height: 640,
        backgroundColor: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 22,
        padding: "56px 64px",
        boxSizing: "border-box",
        boxShadow: "0 12px 40px rgba(20,24,26,0.06)",
      }}
    >
      {/*
        绝对定位的子元素是相对「边框盒」定位的，会绕过 padding。
        所以中间垫一层普通流的容器：它的原点就是内容盒原点，内边距才真正生效。
      */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 28,
        fontSize: 29,
        lineHeight: 1.68,
        color: C.muted,
        borderLeft: `4px solid ${C.reclaimLine}`,
        paddingLeft: 22,
      }}
    >
      {children}
    </div>
  );
}

/** 行内强调。JSX 里写 **粗体** 会原样显示星号，所以用组件。 */
function Em({ children }: { children: ReactNode }) {
  return <span style={{ color: C.text, fontWeight: 700 }}>{children}</span>;
}

function Chip({
  children,
  tone = "plain",
}: {
  children: ReactNode;
  tone?: "plain" | "bad" | "good";
}) {
  const bg = tone === "bad" ? "#fbeceb" : tone === "good" ? C.primarySoft : "#f2f4f2";
  const fg = tone === "bad" ? C.danger : tone === "good" ? C.primary : C.text;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "10px 22px",
        borderRadius: 12,
        backgroundColor: bg,
        color: fg,
        fontSize: 32,
        fontFamily: tone === "plain" ? undefined : MONO,
        marginRight: 16,
      }}
    >
      {children}
    </span>
  );
}

export function Pipeline() {
  const frame = useCurrentFrame();
  const f = (s: number) => sec(s);

  const titleIn = at(frame, 0, 16);
  const titleOut = at(frame, f(2.2), f(3.0));

  return (
    <Frame>
      <BrandTag />

      {/* 顶部流程条：全程常驻，标出当前走到哪一步 */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 26,
          opacity: at(frame, f(2.6), f(3.6)),
        }}
      >
        {STEPS.map((s, i) => {
          const active = frame >= f(s.from) && frame < f(s.to);
          const done = frame >= f(s.to);
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <div
                style={{
                  padding: "12px 26px",
                  borderRadius: 12,
                  fontSize: 30,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#fff" : done ? C.primary : C.faint,
                  backgroundColor: active ? C.primary : done ? C.primarySoft : "transparent",
                  border: `1px solid ${active ? C.primary : done ? C.primarySoft : C.line}`,
                  transition: "none",
                }}
              >
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ color: C.line, fontSize: 28 }}>›</div>
              )}
            </div>
          );
        })}
      </div>

      {/* 开场标题 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 460,
          textAlign: "center",
          fontSize: 76,
          fontWeight: 600,
          color: C.text,
          letterSpacing: 2,
          opacity: titleIn * (1 - titleOut),
        }}
      >
        一句话，怎么变成图上的人
      </div>

      <Card>
        {/* ① 输入 */}
        <Beat frame={frame} from={f(2.5)} to={f(14)}>
          <div style={{ fontSize: 32, color: C.muted, letterSpacing: 2, marginBottom: 26 }}>
            用户在网页上说了一句
          </div>
          <div
            style={{
              fontSize: 48,
              lineHeight: 1.6,
              color: C.text,
              padding: "26px 34px",
              backgroundColor: C.primarySoft,
              borderRadius: 16,
              display: "inline-block",
            }}
          >
            我舅舅 45 岁查出糖尿病，外婆是肺癌走的。
          </div>
          <Note>
            两个亲属、两个病，还用逗号连在一起。
            <br />
            这是最普通的一句话，也是最难处理的一句话。
          </Note>
        </Beat>

        {/* ② 分句 */}
        <Beat frame={frame} from={f(14)} to={f(25)}>
          <div style={{ fontSize: 32, color: C.muted, letterSpacing: 2, marginBottom: 30 }}>
            先切开，每次只让模型面对一个人
          </div>
          <div style={{ fontSize: 38, lineHeight: 2.1, color: C.text }}>
            <div>
              <Chip>我舅舅 45 岁查出糖尿病</Chip>
              <span style={{ color: C.faint, fontSize: 28 }}>→ 抽取 →</span>
              <Chip tone="good">maternal-uncle</Chip>
            </div>
            <div>
              <Chip>外婆是肺癌走的</Chip>
              <span style={{ color: C.faint, fontSize: 28 }}>→ 抽取 →</span>
              <Chip tone="good">maternal-grandmother</Chip>
            </div>
          </div>
          <Note>
            实测：1.7B 在长句里会<Em>系统性漏掉第二个人</Em>。改用分句后问题消失——
            <br />
            我们没有换更大的模型，而是改了输入的形态。
          </Note>
        </Beat>

        {/* ③ 约束解码 */}
        <Beat frame={frame} from={f(25)} to={f(37)}>
          <div style={{ fontSize: 32, color: C.muted, letterSpacing: 2, marginBottom: 26 }}>
            GBNF 约束解码 · 格式在解码层就被锁死
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 25,
              lineHeight: 1.55,
              color: "#2b3330",
              backgroundColor: "#f7f8f7",
              borderRadius: 14,
              padding: "24px 30px",
              whiteSpace: "pre",
            }}
          >
            {'{\n  "persons": [{\n    "relation": "maternal-uncle",   '}
            <span style={{ color: C.primary, fontWeight: 700 }}>← 只能取枚举内的值</span>
            {'\n    "conditions": [{ "code": "糖尿病", "onsetAge": 45 }]\n  }]\n}'}
          </div>
          <Note>
            模型不是在「自由生成 JSON 然后希望它合法」，而是<Em>从解码层就不可能输出非法结构</Em>。
            格式问题在这一步彻底消失，剩下的才是内容问题。
          </Note>
        </Beat>

        {/* ④ 词表校正 */}
        <Beat frame={frame} from={f(37)} to={f(48)}>
          <div style={{ fontSize: 32, color: C.muted, letterSpacing: 2, marginBottom: 32 }}>
            词表校正 · 称谓以原话为准，不以模型判断为准
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 38 }}>
            <span style={{ color: C.muted }}>原话「我舅舅」</span>
            <span style={{ color: C.faint }}>→</span>
            <span
              style={{
                fontFamily: MONO,
                color: C.danger,
                textDecoration: "line-through",
                opacity: 0.75,
              }}
            >
              brother
            </span>
            <span style={{ color: C.faint }}>→</span>
            <span style={{ fontFamily: MONO, color: C.primary, fontWeight: 700 }}>
              maternal-uncle
            </span>
          </div>
          <Note>
            舅舅是母亲的兄弟。模型稳定抽成 brother——把二级亲属错认成一级，下游风险权重直接算错。
            <br />
            所以加一层规则：句中只出现唯一称谓时，<Em>以词表为准覆盖模型判断</Em>。
          </Note>
        </Beat>

        {/* ⑤ 证据校验 */}
        <Beat frame={frame} from={f(48)} to={f(60)}>
          <div style={{ fontSize: 32, color: C.muted, letterSpacing: 2, marginBottom: 30 }}>
            证据校验 · 原文没提到的病，一律删掉
          </div>
          <div style={{ fontSize: 36, lineHeight: 1.9 }}>
            <div>
              <Chip>心梗</Chip>
              <span style={{ fontSize: 28, color: C.primary }}>原文有「心梗」→ 保留</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "10px 22px",
                  borderRadius: 12,
                  backgroundColor: "#fbeceb",
                  color: C.danger,
                  fontSize: 32,
                  textDecoration: "line-through",
                }}
              >
                脑卒中
              </span>
              <span style={{ fontSize: 28, color: C.danger, marginLeft: 16 }}>
                原文没有 → 删除
              </span>
            </div>
          </div>
          <Note>
            约束解码保证 JSON 合法，保证不了内容有依据。模型确实凭空补过一个「脑卒中」。
            <br />
            加这条硬规则后，口语评测集 <Em>Precision = 1.000</Em>：抽出来的每个病都能在原话里找到。
          </Note>
        </Beat>

        {/* 收尾数字 */}
        <Beat frame={frame} from={f(60)} to={f(62.5)}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              height: "100%",
              textAlign: "center",
            }}
          >
            {[
              { v: "0.952", k: "规整句 F1" },
              { v: "1.000", k: "口语集 Precision" },
              { v: "23", k: "单元测试" },
            ].map((s) => (
              <div key={s.k}>
                <div style={{ fontSize: 96, fontWeight: 700, color: C.primary }}>{s.v}</div>
                <div style={{ fontSize: 30, color: C.muted, marginTop: 12 }}>{s.k}</div>
              </div>
            ))}
          </div>
        </Beat>
      </Card>
    </Frame>
  );
}
