import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, H, Sub, Tag, fadeIn, rise } from "../ui";
import { blockById, lineStart } from "../schedule";

/** 我们在做什么：一句话说清产品定位 + 三块输出。 */
export const WhatWeDo: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("whatwedo");
  const outs = [
    ["现在的风险", "三套公开引擎，各自分层", C.primary],
    ["多少能改", "可回收拆分：能改 vs 改不了", HUES.value],
    ["这周做什么", "两件性价比最高的事", HUES.product],
  ];
  return (
    <Stage eyebrow="我们做什么" eyebrowColor={HUES.background} bg="#fbf7f1">
      <Tag text="01 项目背景" color={HUES.background} opacity={0.9} />
      <H size={74}>
        把口述整理成结构化的家系，<span style={{ color: HUES.background }}>再算三件事</span>
      </H>
      <div style={{ display: "flex", gap: 26, marginTop: 52 }}>
        {outs.map(([t, d, c], i) => {
          const p = fadeIn(frame, lineStart(b, 1) + i * 12, 16);
          return (
            <div key={t as string} style={{ ...rise(p, 18), opacity: p, flex: 1, borderTop: "5px solid " + c, paddingTop: 18 }}>
              <div style={{ fontSize: 40, fontWeight: 800 }}>{t}</div>
              <Sub size={26} style={{ marginTop: 10 }}>{d}</Sub>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 60, opacity: fadeIn(frame, lineStart(b, 2), 16), fontSize: 30, color: C.muted }}>
        整条链路跑在<b style={{ color: C.text }}>你自己这台电脑</b>上，家族病史不出机器。
      </div>
    </Stage>
  );
};

/** 技术路线：五层单向依赖。 */
export const Arch: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("arch");
  const layers = ["表现层 · React / Next.js", "接口层 · Route Handlers", "领域层 · 纯函数（可单测）", "引擎层 · 确定性计算", "存储层 · 本机 MySQL"];
  return (
    <Stage eyebrow="架构" eyebrowColor={HUES.tech} bg={C.bg}>
      <Tag text="03 技术路线" color={HUES.tech} opacity={0.9} />
      <H size={72}>五层，<span style={{ color: HUES.tech }}>依赖方向只有一个</span></H>
      <div style={{ marginTop: 40, width: 1180 }}>
        {layers.map((l, i) => {
          const p = fadeIn(frame, 10 + i * 12, 14);
          return (
            <div
              key={l}
              style={{
                ...rise(p, 10),
                opacity: p,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "16px 22px",
                marginBottom: 10,
                background: i < 2 ? "#fff" : HUES.tech + "10",
                border: "1px solid " + C.line,
                borderLeft: "4px solid " + (i < 2 ? C.lineStrong : HUES.tech),
                borderRadius: 10,
                fontSize: 28,
              }}
            >
              <span style={{ width: 34, color: HUES.tech, fontWeight: 800, fontFamily: "Consolas, monospace" }}>L{i + 1}</span>
              {l}
            </div>
          );
        })}
      </div>
      <Sub size={26} style={{ marginTop: 22, opacity: fadeIn(frame, lineStart(b, 1), 14) }}>
        换掉任何模型，风险结论都不变——因为判定在引擎层，用纯函数算。
      </Sub>
    </Stage>
  );
};

/** 部署与成本。 */
export const Deploy: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("deploy");
  const rows = [
    ["推理", "一块显卡跑 llama-server，127.0.0.1:8080"],
    ["存储", "本机 MySQL，家系与体检数字整份覆盖保存"],
    ["公网", "只有一台入口机，上面既没有代码也没有数据"],
    ["断网", "演示可继续，读的是本地库"],
  ];
  return (
    <Stage eyebrow="部署" eyebrowColor={HUES.value} bg={C.bg}>
      <Tag text="05 价值与落地" color={HUES.value} opacity={0.9} />
      <H size={72}>一台电脑<span style={{ color: HUES.value }}>跑完全部</span></H>
      <div style={{ marginTop: 44 }}>
        {rows.map(([k, v], i) => {
          const p = fadeIn(frame, 8 + i * 12, 14);
          return (
            <div key={k} style={{ ...rise(p, 10), opacity: p, display: "flex", gap: 30, padding: "20px 0", borderTop: "1px solid " + C.line }}>
              <div style={{ width: 130, fontSize: 26, color: HUES.value, fontWeight: 800 }}>{k}</div>
              <div style={{ fontSize: 30, color: C.text }}>{v}</div>
            </div>
          );
        })}
      </div>
      <Sub size={25} style={{ marginTop: 26, opacity: fadeIn(frame, lineStart(b, 1) + 20, 14) }}>
        没有按次计费、没有额度限制；整套环境约 4.5 GB 磁盘。
      </Sub>
    </Stage>
  );
};

/** 团队。 */
export const Team: React.FC = () => {
  const frame = useCurrentFrame();
  const people = [
    ["医学与文献", "把每条系数对回原始论文，标注适用人群"],
    ["前端与交互", "一屏工作台、家系图实时可视化"],
    ["模型与部署", "本地推理、约束解码、评测与降级"],
  ];
  return (
    <Stage eyebrow="团队" eyebrowColor={HUES.team} bg={C.bg}>
      <Tag text="06 团队" color={HUES.team} opacity={0.9} />
      <H size={72}>三个人，<span style={{ color: HUES.team }}>各自负责一块</span></H>
      <div style={{ display: "flex", gap: 28, marginTop: 54 }}>
        {people.map(([t, d], i) => {
          const p = fadeIn(frame, 12 + i * 14, 16);
          return (
            <div key={t} style={{ ...rise(p, 16), opacity: p, flex: 1, background: "#fff", border: "1px solid " + C.line, borderRadius: 16, padding: "26px 24px" }}>
              <div style={{ width: 54, height: 54, borderRadius: 12, background: HUES.team, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, marginTop: 16 }}>{t}</div>
              <Sub size={25} style={{ marginTop: 10 }}>{d}</Sub>
            </div>
          );
        })}
      </div>
      <Sub size={26} style={{ marginTop: 40 }}>
        花最多时间的地方，是把每一个数字的出处查清楚。
      </Sub>
    </Stage>
  );
};
