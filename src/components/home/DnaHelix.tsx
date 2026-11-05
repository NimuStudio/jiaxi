"use client";

import { useEffect, useRef } from "react";

/**
 * 首页 DNA 双螺旋（canvas 手写三维投影）。
 *
 * 为什么不用 three.js：首屏体积已经量过（未压缩约 620KB、gzip 约 190KB），
 * 引一个 600KB+ 的引擎只为一段装饰动画不划算。这里用 30 行数学做透视投影，
 * 新增体积可忽略，观感上是真三维（会转、有前后遮挡关系）。
 *
 * 动效约束：尊重 prefers-reduced-motion（改画静态帧）；标签页隐藏时停止渲染。
 */
export function DnaHelix() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let angle = 0.6;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** 画一帧：两条螺旋链 + 碱基对连线，按深度调透明度 */
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width * 0.17, 74);
      const span = height * 0.86;
      const turns = 2.6;
      const steps = 74;
      const perspective = 320;

      type Pt = { x: number; y: number; z: number };
      // 两条链分开存（避免 pts[s] 在严格模式下被判为可能 undefined）
      const strandA: Pt[] = [];
      const strandB: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2 * turns;
        const y = -span / 2 + (span * i) / steps;
        for (const [target, phase] of [[strandA, 0], [strandB, Math.PI]] as const) {
          const a = t + phase + angle;
          const x = Math.cos(a) * radius;
          const z = Math.sin(a) * radius;
          const k = perspective / (perspective - z);
          target.push({ x: cx + x * k, y: cy + y * k, z });
        }
      }

      // 碱基对（先画，让链走在前面）
      for (let i = 0; i <= steps; i += 2) {
        const a = strandA[i];
        const b = strandB[i];
        if (!a || !b) continue;
        const depth = (a.z + b.z) / 2 / radius; // -1..1
        const alpha = 0.1 + (depth + 1) * 0.11;
        ctx.strokeStyle = `rgba(26, 111, 181, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // 两条链的骨架与节点
      for (const [s, line] of [strandA, strandB].entries()) {
        ctx.beginPath();
        for (let i = 0; i < line.length; i++) {
          const p = line[i];
          if (!p) continue;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = s === 0 ? "rgba(26, 111, 181, 0.55)" : "rgba(15, 124, 140, 0.5)";
        ctx.lineWidth = 1.6;
        ctx.stroke();

        for (let i = 0; i < line.length; i += 3) {
          const p = line[i];
          if (!p) continue;
          const depth = p.z / radius;
          const r = 1.6 + (depth + 1) * 1.5;
          const alpha = 0.22 + (depth + 1) * 0.26;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle =
            s === 0
              ? `rgba(26, 111, 181, ${alpha.toFixed(3)})`
              : `rgba(15, 124, 140, ${(alpha * 0.9).toFixed(3)})`;
          ctx.fill();
        }
      }
    };

    const loop = () => {
      angle += 0.006;
      draw();
      raf = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) {
      draw();
    } else {
      raf = window.requestAnimationFrame(loop);
    }

    const onResize = () => {
      resize();
      if (reduce) draw();
    };
    const onVisibility = () => {
      if (reduce) return;
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = window.requestAnimationFrame(loop);
      }
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="dna-hero" aria-hidden="true">
      <canvas ref={canvasRef} className="dna-canvas" />
      <div className="dna-caption">
        <p className="dna-caption-title">同一段家族史，暴露不同，结局差很多</p>
        <p className="dna-caption-body">
          遗传给你的是「底子」，饮食、吸烟、体重决定这份底子被激活多少。
        </p>
      </div>
    </div>
  );
}
