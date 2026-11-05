"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 数字滚动动画：值变化时从旧值平滑滚到新值。
 *
 * 用于关键风险数字（首页可回收风险、/cvd 大数字、问答事实卡）。
 * 演示场景里拖滑块、改输入框时，数字跟着滚——比瞬间跳变更有「在算」的感觉。
 *
 * - 首次渲染从 0 滚到目标，之后从上一个值滚到新值；
 * - prefers-reduced-motion 时直接显示目标值（无动画）；
 * - duration 期间多次变化时，以最新目标为准续滚。
 */
export function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0) {
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic：先快后慢，收尾稳
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (target - from) * eased;
      setDisplay(value);
      fromRef.current = value;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setDisplay(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}
