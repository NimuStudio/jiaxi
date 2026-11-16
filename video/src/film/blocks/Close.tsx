import React from "react";
import { useCurrentFrame } from "remotion";
import { C, HUES } from "../../theme";
import { Stage, fadeIn, rise } from "../ui";
import { blockById, lineStart } from "../schedule";

/** 收尾：三样交付物 + 一句话。 */
export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const b = blockById("close");
  const a1 = lineStart(b, 0);
  const a2 = lineStart(b, 1);

  return (
    <Stage bg={C.ink} padTop={0}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 160px" }}>
        <div style={{ ...rise(fadeIn(frame, 4, 20), 20), display: "flex", gap: 40, marginBottom: 60 }}>
          {[
            ["家系图", "从一句口述直接长出来"],
            ["三套风险", "对齐原始文献，可复算"],
            ["可回收方案", "能改的与改不了的分开算"],
          ].map(([t, d]) => (
            <div key={t} style={{ flex: 1, borderTop: "4px solid " + HUES.value, paddingTop: 16 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#fff" }}>{t}</div>
              <div style={{ fontSize: 24, color: "#9fbdd8", marginTop: 8, lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            ...rise(fadeIn(frame, a2, 22), 24),
            fontSize: 74,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.34,
            letterSpacing: -1,
          }}
        >
          把家族史从一句话，
          <br />
          变成<span style={{ color: "#7fc3cb" }}>能算、能改、能复算</span>的东西。
        </div>

        <div style={{ marginTop: 54, opacity: fadeIn(frame, a2 + 30, 18), display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#fff", color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
            家
          </div>
          <div style={{ fontSize: 30, color: "#9fbdd8", letterSpacing: 1 }}>家系 Pedigree · AI 与健康</div>
        </div>
      </div>
    </Stage>
  );
};
