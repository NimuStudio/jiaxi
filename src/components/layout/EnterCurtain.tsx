"use client";

import { useEffect, useState } from "react";

/**
 * 进入主界面时的开屏过渡。
 *
 * 复用登录页「沿对角线撕开」的语言（同样的 clip-path、同样的 ±46% 位移与缓动），
 * 让「登录页 → 主界面」在动效上是同一套动作，而不是硬切。
 * 整段约 1.25s，只跑一次（每次整页加载），结束后从 DOM 移除。
 */
export function EnterCurtain() {
  const [phase, setPhase] = useState<"closed" | "open" | "done">("closed");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    // 先让闭合态停留一小会儿（120ms），否则幕布一闪而过、看不到「闭合 → 撕开」这个动作
    const openTimer = window.setTimeout(() => setPhase("open"), 120);
    const doneTimer = window.setTimeout(() => setPhase("done"), 1400);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div className={`enter-curtain${phase === "open" ? " is-open" : ""}`} aria-hidden="true">
      <div className="enter-half enter-upper" />
      <div className="enter-half enter-lower" />
      <svg className="enter-seam" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="12" x2="100" y2="100" />
      </svg>
    </div>
  );
}
