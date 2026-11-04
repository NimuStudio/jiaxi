import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT } from "../theme";

/**
 * 统一背景：极浅的绿调底 + 中心柔光。
 *
 * 不用纯白——1080p 下纯白在大屏上会发灰、也会让后面的界面截图显得脏。
 */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        fontFamily: FONT,
        // 中心柔光，把注意力压到画面中部
        backgroundImage:
          "radial-gradient(1200px 800px at 50% 42%, #ffffff 0%, rgba(255,255,255,0) 70%)",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/** 左上角的产品标识，全程常驻，弱化但不断。 */
export function BrandTag() {
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 96,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: 0.55,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          backgroundColor: C.primary,
        }}
      />
      <span style={{ fontSize: 24, color: C.muted, letterSpacing: 3 }}>家系</span>
    </div>
  );
}
