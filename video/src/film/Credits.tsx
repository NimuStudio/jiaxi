import React from "react";
import { C } from "../theme";

/**
 * 片尾署名卡：CC BY 4.0 要求署名，这是用真实曲库音乐的代价。
 * 3 秒，纯文字，无动画 —— 署名要能被截图核对。
 */
export const Credits: React.FC = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: C.ink,
      fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
      color: "#cfe0f0",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 18,
      padding: 80,
      boxSizing: "border-box",
    }}
  >
    <div style={{ fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>音乐署名 · Music Credits</div>
    <div style={{ fontSize: 26, textAlign: "center", lineHeight: 1.6 }}>
      「Funkorama」「Funk Game Loop」「Disco Medusae」「Wallpaper」
      <br />
      Kevin MacLeod (incompetech.com)
      <br />
      Licensed under Creative Commons: By Attribution 4.0
    </div>
  </div>
);
