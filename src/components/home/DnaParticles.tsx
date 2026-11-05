"use client";

import { useEffect, useRef } from "react";

/**
 * 登录页背景：完全由粒子组成的 DNA，鼠标靠近时粒子散开、离开后弹回。
 *
 * 交互模型（每个粒子独立，O(n) 每帧）：
 *  1. 粒子有"家"——它在双螺旋上的三维位置，随视角缓慢旋转后投影到屏幕；
 *  2. 鼠标半径 R 内的粒子受到向外的推力，力度随距离平方衰减；
 *  3. 同时始终有一个把粒子拉回家（投影位置）的弹簧力，配合阻尼回弹。
 *
 * 性能：
 *  - 光斑贴图预渲染成 3 张 64px 图，每帧只做 drawImage；
 *  - dpr 上限 1.5；窄屏自动降粒子数；标签页隐藏停帧；reduced-motion 只画一帧。
 */
export function DnaParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let angle = 0.15;
    let w = 1;
    let h = 1;
    const pointer = { x: -9999, y: -9999, active: false };

    const sprite = (rgb: string) => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, `rgba(${rgb}, 1)`);
        grad.addColorStop(0.4, `rgba(${rgb}, 0.5)`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      return c;
    };
    const SPR = { blue: sprite("92, 156, 224"), cyan: sprite("92, 212, 218"), white: sprite("236, 246, 255") };

    type P = {
      /** 三维家坐标（单位半径） */
      hx: number;
      hy: number;
      hz: number;
      size: number;
      tint: 0 | 1 | 2; // blue / cyan / white
      /** 屏幕空间偏移与速度 */
      ox: number;
      oy: number;
      vx: number;
      vy: number;
    };

    const rnd = mulberry(20261105);
    let particles: P[] = [];

    const build = () => {
      const out: P[] = [];
      const small = w < 760;
      const strandN = small ? 520 : 1300;
      const rungN = small ? 60 : 150;
      const turns = 2.9;

      for (let i = 0; i < strandN; i++) {
        const t = (i / strandN) * Math.PI * 2 * turns;
        const y = i / strandN - 0.5;
        for (const [phase, tint] of [[0, 0], [Math.PI, 1]] as const) {
          // 半径带抖动：看起来是粒子云，不是一根管子
          const r = 0.92 + rnd() * 0.16;
          out.push({
            hx: Math.cos(t + phase) * r,
            hy: y * (0.86 + rnd() * 0.03),
            hz: Math.sin(t + phase) * r,
            size: 0.9 + rnd() * 1.5,
            tint,
            ox: 0, oy: 0, vx: 0, vy: 0,
          });
        }
      }

      for (let i = 0; i < rungN; i++) {
        const t = (i / rungN) * Math.PI * 2 * turns;
        const y = i / rungN - 0.5;
        const k = rnd();
        const ax = Math.cos(t), az = Math.sin(t);
        const bx = Math.cos(t + Math.PI), bz = Math.sin(t + Math.PI);
        out.push({
          hx: ax + (bx - ax) * k,
          hy: y * 0.86,
          hz: az + (bz - az) * k,
          size: 0.7 + rnd() * 1.1,
          tint: k < 0.5 ? 0 : 1,
          ox: 0, oy: 0, vx: 0, vy: 0,
        });
      }

      return out;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = build();
    };

    const draw = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      // 底色柔光
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.75);
      bg.addColorStop(0, "rgba(214, 232, 249, 0.5)");
      bg.addColorStop(0.6, "rgba(234, 243, 252, 0.2)");
      bg.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.46;
      const cy = h * 0.44;
      const base = Math.min(w * 0.3, h * 0.36);
      const radius = base * 0.62;
      const span = base * 2.3;
      const persp = 620;

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const R = 145; // 鼠标影响半径
      const R2 = R * R;

      ctx.globalCompositeOperation = "lighter";

      for (const p of particles) {
        // 绕 Y 轴旋转后再投影
        const x3 = p.hx * cos - p.hz * sin;
        const z3 = p.hx * sin + p.hz * cos;
        const k = persp / (persp - z3 * radius);
        const homeX = cx + x3 * radius * k;
        const homeY = cy + p.hy * span * k;

        let px = homeX + p.ox;
        let py = homeY + p.oy;

        // 鼠标排斥
        if (pointer.active) {
          const dx = px - pointer.x;
          const dy = py - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / R) ** 2 * 52;
            p.vx += (dx / d) * force;
            p.vy += (dy / d) * force;
          }
        }

        // 弹簧回家 + 阻尼
        p.vx += (homeX - px) * 0.055;
        p.vy += (homeY - py) * 0.055;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.ox += p.vx;
        p.oy += p.vy;
        px = homeX + p.ox;
        py = homeY + p.oy;

        const depth = Math.min(1, Math.max(0, (z3 + 1) / 2));
        const alpha = 0.04 + Math.pow(depth, 1.7) * 0.8;
        const s = p.size * k * (0.55 + depth * 0.9) * 2.3;
        if (s <= 0.15) continue;

        const img = p.tint === 0 ? SPR.blue : p.tint === 1 ? SPR.cyan : SPR.white;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(img, px - s / 2, py - s / 2, s, s);

        // 前侧粒子加一圈光晕 → 发光核心
        if (depth > 0.72) {
          const halo = s * 2.6;
          ctx.globalAlpha = Math.min(0.16, (depth - 0.72) * 0.8);
          ctx.drawImage(img, px - halo / 2, py - halo / 2, halo, halo);
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = () => {
      angle += 0.0026;
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
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="dna-particles" aria-hidden="true" />;
}

function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
