import React from "react";
import { C, HUES } from "../theme";

/** 封面：用于提交页与视频首帧之外的单独一张图。 */
export const Cover: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: "radial-gradient(120% 120% at 82% 8%, #17395c 0%, " + C.ink + " 58%, #07131f 100%)",
      fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
      color: "#fff",
      padding: "120px 120px",
      boxSizing: "border-box",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* 三个栏目色，做成右上角的三道细条 */}
    <div style={{ position: "absolute", top: 0, right: 120, display: "flex", gap: 8 }}>
      {[HUES.background, HUES.product, HUES.value].map((c) => (
        <div key={c} style={{ width: 12, height: 96, background: c }} />
      ))}
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#8fb6d6", letterSpacing: 2 }}>
      AI 与健康 · 作品提交
    </div>

    <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: 6, marginTop: 26, lineHeight: 1.1 }}>
      家 系
    </div>
    <div style={{ fontSize: 30, color: "#9fbdd8", letterSpacing: 6, marginTop: 6 }}>PEDIGREE</div>

    <div style={{ fontSize: 58, fontWeight: 700, marginTop: 56, lineHeight: 1.42 }}>
      把家族口述的病史，整理成一张家系图
      <br />
      并算出你的风险里，<span style={{ color: "#7fc3cb" }}>有多少是能拿回来的</span>
    </div>

    <div style={{ position: "absolute", left: 120, bottom: 96, display: "flex", gap: 40, fontSize: 24, color: "#8fb6d6" }}>
      <span>FINDRISC · China-PAR · PLCOm2012</span>
      <span>100% 本机推理</span>
      <span>留出集 F1 1.000</span>
    </div>
  </div>
);
