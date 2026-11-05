"use client";

import { useEffect, useRef } from "react";

/**
 * 登录页的 DNA 双螺旋（canvas 手绘透视投影，无第三方 3D 引擎）。
 *
 * 相比上一版（首页那个被评价"太简陋"的）：碱基对更多、按深度做颜色与亮度插值、
 * 加了辉光与纵向渐隐、轻微俯仰角，旋转更慢。仍然不引 three.js：
 * 首屏体积已经量过，为一段装饰动画背 600KB+ 引擎不划算。
 *
 * 约束：尊重 prefers-reduced-motion；标签页隐藏时停止渲染。
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
    let angle = 0.35;
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

    type Pt = { x: number; y: number; z: number };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w * 0.2, 120);
      const span = h * 0.92;
      const turns = 3.2;
      const steps = 132;
      const persp = 420;
      const tilt = -0.28; // 轻微俯仰，避免正面看像弹簧

      const strandA: Pt[] = [];
      const strandB: Pt[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2 * turns;
        const y0 = -span / 2 + (span * i) / steps;
        for (const [target, phase] of [[strandA, 0], [strandB, Math.PI]] as const) {
          const a = t + phase + angle;
          const x3 = Math.cos(a) * radius;
          const z3 = Math.sin(a) * radius;
          // 绕 X 轴做俯仰
          const y3 = y0 * Math.cos(tilt) - z3 * Math.sin(tilt);
          const z4 = y0 * Math.sin(tilt) + z3 * Math.cos(tilt);
          const k = persp / (persp - z4);
          target.push({ x: cx + x3 * k, y: cy + y3 * k, z: z4 });
        }
      }

      // 碱基对（先画，让链压在前面）
      for (let i = 0; i <= steps; i += 2) {
        const a = strandA[i];
        const b = strandB[i];
        if (!a || !b) continue;
        const depth = (a.z + b.z) / 2 / radius; // -1..1
        const alpha = 0.06 + (depth + 1) * 0.09;
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `rgba(37, 99, 173, ${alpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(14, 148, 138, ${alpha.toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // 两条链：按深度插值颜色与亮度
      const strands: Array<[Pt[], [number, number, number], [number, number, number]]> = [
        [strandA, [37, 99, 173], [126, 178, 232]],
        [strandB, [15, 124, 140], [141, 209, 214]],
      ];
      for (const [line, dark, light] of strands) {
        ctx.beginPath();
        for (let i = 0; i < line.length; i++) {
          const p = line[i];
          if (!p) continue;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = `rgba(${dark[0]}, ${dark[1]}, ${dark[2]}, 0.42)`;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        for (let i = 0; i < line.length; i += 2) {
          const p = line[i];
          if (!p) continue;
          const depth = p.z / radius; // -1..1
          const mix = (depth + 1) / 2;
          const r = Math.round(dark[0] + (light[0] - dark[0]) * mix);
          const g = Math.round(dark[1] + (light[1] - dark[1]) * mix);
          const bl = Math.round(dark[2] + (light[2] - dark[2]) * mix);
          const alpha = 0.18 + mix * 0.62;
          const size = 1.2 + mix * 2.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${alpha.toFixed(3)})`;
          if (mix > 0.72) {
            // 靠前的节点给一点辉光
            ctx.shadowColor = `rgba(${r}, ${g}, ${bl}, 0.55)`;
            ctx.shadowBlur = 8;
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    };

    const loop = () => {
      angle += 0.0042;
      draw();
      raf = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) draw();
    else raf = window.requestAnimationFrame(loop);

    const onResize = () => {
      resize();
      if (reduce) draw();
    };
    const onVis = () => {
      if (reduce) return;
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = window.requestAnimationFrame(loop);
      }
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
