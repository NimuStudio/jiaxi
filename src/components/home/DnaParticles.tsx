"use client";

import { useEffect, useRef } from "react";

/**
 * 登录页的 DNA：粒子化双螺旋。
 *
 * 为什么不用线条：线框只有"骨架"，看起来像示意图。这里把双螺旋离散成
 * 约 1400 个发光粒子——两条链各约 500 个、碱基对约 300 个、漂浮尘埃约 120 个，
 * 用加法混合叠出体积感。
 *
 * 性能做法（关键）：每帧不画渐变，而是**预渲染三张光斑贴图**（蓝/青/白），
 * 之后每个粒子只做一次 drawImage。这样 1400 次绘制在普通笔记本上仍是 60fps。
 * 另外：dpr 上限 1.5、标签页隐藏即停、尊重 prefers-reduced-motion（只画一帧）。
 */
export function DnaParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = motionReduced();
    let raf = 0;
    let angle = 0;
    let w = 1;
    let h = 1;
    let pointer = { x: 0, y: 0 };

    /** 预渲染光斑：radial gradient 只做一次 */
    const sprite = (rgb: string) => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, `rgba(${rgb}, 1)`);
        grad.addColorStop(0.35, `rgba(${rgb}, 0.55)`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      return c;
    };

    const SPR = {
      blue: sprite("86, 150, 220"),
      cyan: sprite("96, 214, 220"),
      white: sprite("235, 246, 255"),
    };

    type P = {
      kind: "strandA" | "strandB" | "rung" | "dust";
      t: number; // 沿螺旋的参数 0..1
      r: number; // 半径抖动
      phase: number;
      size: number;
      jitter: number;
    };

    // 预先固定随机量，避免每帧抖动
    const rnd = mulberry(20261105);

    const STRAND_N = 720;
    const RUNG_N = 96;
    const DUST_N = 120;

    const build = (): P[] => {
      const out: P[] = [];
      for (let i = 0; i < STRAND_N; i++) {
        // 半径带一点抖动：链看起来是"粒子云"而不是一根管
        const jr = 0.94 + rnd() * 0.12;
        out.push({ kind: "strandA", t: i / STRAND_N, r: jr, phase: 0, size: 1.1 + rnd() * 1.5, jitter: rnd() });
        out.push({ kind: "strandB", t: i / STRAND_N, r: jr, phase: Math.PI, size: 1.1 + rnd() * 1.5, jitter: rnd() });
      }
      for (let i = 0; i < RUNG_N; i++) {
        out.push({ kind: "rung", t: i / RUNG_N, r: 1, phase: 0, size: 1.1 + rnd() * 0.9, jitter: rnd() });
      }
      for (let i = 0; i < DUST_N; i++) {
        out.push({ kind: "dust", t: rnd(), r: 0.3 + rnd() * 1.9, phase: rnd() * Math.PI * 2, size: 0.8 + rnd() * 1.4, jitter: rnd() });
      }
      return out;
    };

    let particles = build();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      // 背景柔光
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.7);
      bg.addColorStop(0, "rgba(214, 232, 249, 0.55)");
      bg.addColorStop(0.55, "rgba(234, 243, 252, 0.22)");
      bg.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2 + pointer.x * 7;
      const cy = h / 2 + pointer.y * 7;
      const base = Math.min(w * 0.3, h * 0.34);
      const radius = base * 0.62;
      const span = base * 2.25;
      const turns = 2.9;
      const persp = 520;

      ctx.globalCompositeOperation = "lighter"; // 加法混合 → 叠加处更亮

      for (const p of particles) {
        let x3: number;
        let y3: number;
        let z3: number;
        let sizeScale = 1;
        let rgb = "86, 150, 220";

        if (p.kind === "dust") {
          const t = (p.t + angle * 0.05) % 1;
          x3 = Math.cos(t * Math.PI * 2 + p.phase) * radius * p.r * 1.55;
          y3 = -span / 2 + span * t + Math.sin(p.phase) * 22;
          z3 = Math.sin(t * Math.PI * 2 + p.phase) * radius * p.r * 1.55;
          sizeScale = 0.7;
          rgb = "176, 206, 232";
        } else if (p.kind === "rung") {
          // 碱基对的粒子：沿两根链之间的连线分布
          const t = p.t * Math.PI * 2 * turns + angle;
          const y = -span / 2 + span * p.t;
          const a = { x: Math.cos(t) * radius, z: Math.sin(t) * radius };
          const b = { x: Math.cos(t + Math.PI) * radius, z: Math.sin(t + Math.PI) * radius };
          const k = p.jitter; // 0..1 沿连线位置
          x3 = a.x + (b.x - a.x) * k;
          z3 = a.z + (b.z - a.z) * k;
          y3 = y;
          rgb = k < 0.5 ? "120, 170, 215" : "110, 195, 205";
          sizeScale = 0.85;
        } else {
          const t = p.t * Math.PI * 2 * turns + angle + p.phase;
          const y = -span / 2 + span * p.t;
          x3 = Math.cos(t) * radius * p.r;
          z3 = Math.sin(t) * radius * p.r;
          y3 = y + Math.sin(t) * 6;
          rgb = p.kind === "strandA" ? "96, 160, 226" : "92, 210, 214";
        }

        const k = persp / (persp - z3);
        const x = cx + x3 * k;
        const y = cy + y3 * k;
        const depth = (z3 + radius) / (2 * radius); // 0..1
        // 中间值：粒子看得出是一颗一颗，但不至于暗成粉尘
        const alpha = 0.1 + Math.pow(depth, 1.6) * 0.95;
        const s = p.size * sizeScale * k * (0.6 + depth * 0.85) * 2.45;
        if (s <= 0.2) continue;

        const img = p.kind === "dust" ? SPR.white : p.kind === "strandB" ? SPR.cyan : SPR.blue;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(img, x - s / 2, y - s / 2, s, s);

        // 前侧粒子再叠一圈更大的淡光斑：形成"发光核心"，这是体积感的来源
        if (depth > 0.62 && p.kind !== "dust") {
          const halo = s * 3.1;
          ctx.globalAlpha = Math.min(0.32, (depth - 0.62) * 1.5);
          ctx.drawImage(img, x - halo / 2, y - halo / 2, halo, halo);
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = () => {
      angle += 0.0028;
      draw();
      raf = window.requestAnimationFrame(loop);
    };

    resize();
    if (reduce) draw();
    else raf = window.requestAnimationFrame(loop);

    const onResize = () => {
      resize();
      particles = build();
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
      pointer = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      };
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="dna-particles" aria-hidden="true" />;
}

function motionReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 固定种子的伪随机：保证每次刷新粒子分布一致，不会"跳动" */
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
