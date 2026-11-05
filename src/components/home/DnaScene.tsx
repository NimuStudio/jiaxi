"use client";

import { useEffect, useRef } from "react";

/**
 * 登录页的 DNA 双螺旋。
 *
 * 上一版的线看起来乱，原因有两个（已修）：
 *  1. 碱基对画满整圈：背面的连线穿到前面来，视觉上变成一堆横穿的长线；
 *  2. 没有深度排序：远景节点压住近景，画面发糊。
 * 现在只画前半球（z>0）的碱基对、并且全部图元按 z 从远到近绘制，
 * 再叠一层柔光与纵向渐隐，读起来才像"结构"而不是"毛线团"。
 */
export function DnaScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let angle = 0.2;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    type P = { x: number; y: number; z: number; t: number };
    type Drawable = { z: number; paint: () => void };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // 柔光背景：让螺旋有"从光里长出来"的感觉
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.62);
      glow.addColorStop(0, "rgba(206, 228, 248, 0.55)");
      glow.addColorStop(0.55, "rgba(226, 240, 252, 0.22)");
      glow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w * 0.19, 108);
      const span = h * 0.8;
      const turns = 2.4; // 圈数少 → 碱基对更像梯级，不像辐条
      const steps = 96;
      const persp = 460;

      const A: P[] = [];
      const B: P[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2 * turns;
        const y0 = -span / 2 + (span * i) / steps;
        for (const [target, phase] of [[A, 0], [B, Math.PI]] as const) {
          const a = t + phase + angle;
          const x3 = Math.cos(a) * radius;
          const z3 = Math.sin(a) * radius;
          const k = persp / (persp - z3);
          target.push({ x: cx + x3 * k, y: cy + y0 * k, z: z3, t: i / steps });
        }
      }

      const items: Drawable[] = [];

      // ① 碱基对：只画前半球，且隔一段画一根
      for (let i = 0; i <= steps; i += 3) {
        const a = A[i];
        const b = B[i];
        if (!a || !b) continue;
        const zMid = (a.z + b.z) / 2;
        if (zMid < 0) continue; // 背面不画，避免长线横穿
        const depth = zMid / radius; // 0..1
        const alpha = 0.05 + depth * 0.16;
        const paint = () => {
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, `rgba(52, 112, 178, ${alpha.toFixed(3)})`);
          grad.addColorStop(0.5, `rgba(120, 160, 205, ${(alpha * 0.7).toFixed(3)})`);
          grad.addColorStop(1, `rgba(20, 138, 148, ${alpha.toFixed(3)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.9 + depth * 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        };
        items.push({ z: zMid, paint });
      }

      // ② 两条链：按每段中点的深度排序，远的先画
      const strands: Array<[P[], string, string]> = [
        [A, "52, 112, 178", "26, 92, 150"],
        [B, "20, 148, 156", "16, 118, 128"],
      ];
      for (let s = 0; s < strands.length; s++) {
        const entry = strands[s];
        if (!entry) continue;
        const [line, rgbFront] = entry;
        for (let i = 0; i < line.length - 1; i++) {
          const p1 = line[i];
          const p2 = line[i + 1];
          if (!p1 || !p2) continue;
          const zMid = (p1.z + p2.z) / 2;
          const depth = (zMid + radius) / (2 * radius); // 0..1
          const alpha = 0.08 + depth * 0.72;
          const width = 0.8 + depth * 2.1;
          const paint = () => {
            ctx.strokeStyle = `rgba(${rgbFront}, ${alpha.toFixed(3)})`;
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          };
          items.push({ z: zMid, paint });
        }
      }

      // ③ 节点：小圆点，前侧加一点辉光
      for (let s = 0; s < 2; s++) {
        const line = s === 0 ? A : B;
        const rgb = s === 0 ? "37, 99, 173" : "17, 132, 142";
        for (let i = 0; i < line.length; i += 2) {
          const p = line[i];
          if (!p) continue;
          const depth = (p.z + radius) / (2 * radius);
          if (depth < 0.34) continue; // 背面节点不画，避免噪点
          const alpha = 0.2 + depth * 0.65;
          const size = 0.9 + depth * 2.1;
          const paint = () => {
            if (depth > 0.8) {
              ctx.shadowColor = `rgba(${rgb}, 0.5)`;
              ctx.shadowBlur = 9;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
            ctx.fill();
            ctx.shadowBlur = 0;
          };
          items.push({ z: p.z, paint });
        }
      }

      items.sort((a, b) => a.z - b.z);
      for (const it of items) it.paint();
    };

    const loop = () => {
      angle += 0.0035;
      draw();
      raf = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) draw();
    else raf = window.requestAnimationFrame(loop);

    const onResize = () => { resize(); if (reduce) draw(); };
    const onVis = () => {
      if (reduce) return;
      if (document.hidden) { window.cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) raf = window.requestAnimationFrame(loop);
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className="dna-scene-canvas" aria-hidden="true" />;
}
