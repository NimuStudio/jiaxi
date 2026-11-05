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
      const strandN = small ? 760 : 2000;
      const rungN = small ? 90 : 260;
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

      // ---- 物理参数（单位：像素 / 秒）----
      const R = 95; // 影响半径：只有很近的粒子才被吹动
      const R2 = R * R;
      const SOFT = 26; // 软化长度：避免 d→0 时力发散成无穷大（真实物理里也有最小作用距离）
      const K = 9.2e6; // 平方反比系数 = 力 × (d² + SOFT²)
      const OMEGA = 10; // 弹簧角频率 ω：决定回弹快慢
      const ZETA = 0.62; // 阻尼比 <1 略欠阻尼：回来时有一点轻微过冲，像真的
      const DRAG = 3.6; // 空气阻力系数（速度每秒衰减 exp(-DRAG·dt)）
      const MAX_V = 4200; // 速度上限，防止极端情况炸开
      const dragK = Math.exp(-DRAG * dtReal);
      const springA = OMEGA * OMEGA;
      const dampA = 2 * ZETA * OMEGA;

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

        // ---- 受力：排斥（平方反比）----
        let ax = 0;
        let ay = 0;
        if (pointer.active) {
          const dx = px - pointer.x;
          const dy = py - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const soft2 = d2 + SOFT * SOFT;
            const mag = K / soft2; // ~1/d²，近处强、远处迅速衰减
            const d = Math.sqrt(d2) || 1;
            // 边界平滑：接近 R 时把力收敛到 0，避免"进圈瞬间被踢一下"
            const edge = 1 - d2 / R2;
            ax += (dx / d) * mag * edge;
            ay += (dy / d) * mag * edge;
          }
        }

        // ---- 受力：弹簧（回家）+ 阻尼 ----
        const dxHome = homeX - px;
        const dyHome = homeY - py;
        ax += springA * dxHome - dampA * p.vx;
        ay += springA * dyHome - dampA * p.vy;

        // ---- 积分（半隐式欧拉，dt 保证不同刷新率手感一致）----
        p.vx = (p.vx + ax * dt) * dragK;
        p.vy = (p.vy + ay * dt) * dragK;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > MAX_V) {
          p.vx = (p.vx / sp) * MAX_V;
          p.vy = (p.vy / sp) * MAX_V;
        }
        p.ox += p.vx * dt;
        p.oy += p.vy * dt;
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

    let last = 0;
    let dtReal = 1 / 60;
    let dt = 1 / 60;
    const loop = (now: number) => {
      if (last) {
        // 限制最大步长：标签页切回来时不会一次积分一大步导致"炸开"
        dtReal = Math.min(0.05, (now - last) / 1000);
      }
      last = now;
      dt = dtReal;
      angle += 0.0026 * (dtReal * 60); // 旋转也与帧率无关
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
