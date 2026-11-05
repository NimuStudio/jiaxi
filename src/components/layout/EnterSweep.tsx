"use client";

import { useEffect, useState } from "react";

/**
 * 进入主界面时的过渡。
 *
 * 不是把登录页的幕布照搬过来 —— 那块不透明的幕布会先给用户一帧空白背景，
 * 看起来像「页面还没加载完」。这里改为：一束斜向的光从左上扫到右下（延续登录页
 * 「一条光缝」的语言），主内容在光后面浮现、轻微上浮。全程没有空白帧。
 */
export function EnterSweep() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    const timer = window.setTimeout(() => setDone(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div className="enter-sweep" aria-hidden="true">
      <span className="enter-sweep-band" />
      <span className="enter-sweep-line" />
    </div>
  );
}
