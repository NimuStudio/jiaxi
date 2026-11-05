"use client";

import { useEffect, useRef } from "react";

/**
 * 登录页背景：粒子化 DNA 双螺旋 + 鼠标排斥。
 *
 * 结构上照着真实的 DNA 画（之前失败的版本是"两条链各自独立"，读起来像两条波浪线）：
 *  - 两条主链：密排的"核苷酸珠"，每颗有高光，看起来是立体小球；
 *  - 碱基对：两条链之间密集的横档，由小粒子连成一条条短棒 —— 这是"梯子"的横级；
 *  - 整体绕 Z 轴倾斜约 17°，避免正面看像弹簧。
 *
 * 交互：鼠标 62px 内的粒子受平方反比推力散开，靠阻尼弹簧回位。
 * 性能：所有贴图（光晕 / 珠体）预渲染，每帧只做 drawImage。
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
    let angle = 0.18;
    let w = 1;
    let h = 1;
    const pointer = { x: -9999, y: -9999, active: false };

    /** 光晕贴图：只做一次 */
    const glowSprite = (rgb: string) => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, `rgba(${rgb}, 1)`);
        grad.addColorStop(0.35, `rgba(${rgb}, 0.55)`);
        grad.addColorStop(0.7, `rgba(${rgb}, 0.16)`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      return c;
    };

    /** 珠体贴图：带左上高光的实心球，看起来是立体的核苷酸 */
    const beadSprite = (base: string, light: string) => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d");
      if (g) {
        // 球体主体
        const body = g.createRadialGradient(size * 0.38, size * 0.34, size * 0.05, size * 0.5, size * 0.5, size * 0.5);
        body.addColorStop(0, light);
        body.addColorStop(0.55, base);
        body.addColorStop(1, `${base}`);
        g.fillStyle = body;
        g.beginPath();
        g.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
        g.fill();
        // 边缘压暗 + 高光点
        const rim = g.createRadialGradient(size * 0.5, size * 0.5, size * 0.3, size * 0.5, size * 0.5, size * 0.48);
        rim.addColorStop(0, "rgba(0,0,0,0)");
        rim.addColorStop(1, "rgba(10, 40, 70, 0.35)");
        g.fillStyle = rim;
        g.beginPath();
        g.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(size * 0.36, size * 0.32, size * 0.09, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.fill();
      }
      return c;
    };

    const SPR = {
      glowBlue: glowSprite("80, 150, 226"),
      glowCyan: glowSprite("70, 200, 210"),
      glowAmber: glowSprite("232, 168, 96"),
      beadBlue: beadSprite("#2f6fb0", "#8fc0ea"),
      beadCyan: beadSprite("#128f9c", "#8ee0e4"),
      beadAmber: beadSprite("#b9762a", "#f0c08a"),
    };

    type P = {
      hx: number;
      hy: number;
      hz: number;
      size: number;
      tint: 0 | 1 | 2;
      ox: number;
      oy: number;
      vx: number;
      vy: number;
    };

    const rnd = mulberry(20261105);
    let particles: P[] = [];
    let rungCount = 0;

    const build = () => {
      const out: P[] = [];
      const small = w < 760;
      // 关键比例：珠子要"少而大"才像参考图里的球体；粒子太密会叠成发光管子。
      // 近景构图：圈数少 + 珠子几乎相触，才像参考图；圈数多了珠子必然被拉开成散点。
      const pairs = small ? 58 : 96; // 碱基对（横档）数量 = 每条链的珠子数量（珠子几乎相触，靠高光区分个体）
      const perStrand = 1; // 一段横档对应一颗链上珠子
      const rungDots = small ? 5 : 7; // 每根横档由几颗小粒子连成
      const turns = 1.55;

      const strandA = (t: number) => Math.cos(t) * 1;
      const strandB = (t: number) => Math.cos(t + Math.PI) * 1;

      // ① 两条主链：密排的核苷酸珠
      const total = pairs * perStrand;
      for (let i = 0; i < total; i++) {
        const t = (i / total) * Math.PI * 2 * turns;
        const y = i / total - 0.5;
        out.push({
          hx: strandA(t),
          hy: y * 0.88,
          hz: Math.sin(t),
          size: 1.7 + rnd() * 0.5,
          tint: 0,
          ox: 0, oy: 0, vx: 0, vy: 0,
        });
        out.push({
          hx: strandB(t),
          hy: y * 0.88,
          hz: Math.sin(t + Math.PI),
          size: 1.7 + rnd() * 0.5,
          tint: 1,
          ox: 0, oy: 0, vx: 0, vy: 0,
        });
      }

      // ② 碱基对：横档上的小粒子（两种颜色交替，像 A-T / G-C 配对）
      for (let p = 0; p < pairs; p++) {
        const t = (p / pairs) * Math.PI * 2 * turns;
        const y = p / pairs - 0.5;
        const ax = strandA(t);
        const az = Math.sin(t);
        const bx = strandB(t);
        const bz = Math.sin(t + Math.PI);
        const amber = p % 2 === 0;
        for (let d = 1; d < rungDots; d++) {
          const k = d / rungDots;
          out.push({
            hx: ax + (bx - ax) * k,
            hy: y * 0.88,
            hz: az + (bz - az) * k,
            size: 0.8 + rnd() * 0.25,
            tint: amber ? 2 : 0,
            ox: 0, oy: 0, vx: 0, vy: 0,
          });
        }
      }

      rungCount = pairs * (rungDots - 1);
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

    let last = 0;
    let dt = 1 / 60;

    const draw = () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);

      const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.75);
      bg.addColorStop(0, "rgba(212, 231, 249, 0.55)");
      bg.addColorStop(0.6, "rgba(233, 242, 252, 0.22)");
      bg.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.47;
      const cy = h * 0.40;
      // 统一尺度：x/y/z 都在"模型单位"里计算，最后只乘以一个 base，
      // 否则先按归一化坐标倾斜、再分别乘 radius/span，会把螺旋切成斜条纹。
      const base = Math.min(w * 0.26, h * 0.31);
      const RAD = 0.86; // 螺旋半径（模型单位）：近景视角下要宽
      const HGT = 2.05; // 螺旋高度（模型单位）
      const persp = 5.2; // 透视距离（模型单位）
      const tiltZ = -0.26; // 整体倾斜
      const cosZ = Math.cos(tiltZ);
      const sinZ = Math.sin(tiltZ);

      const R = 62; // 鼠标影响半径（收小）
      const R2 = R * R;
      const SOFT = 20;
      const K = 6.4e6;
      const OMEGA = 10.5;
      const ZETA = 0.6;
      const dragK = Math.exp(-3.6 * dt);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      for (const p of particles) {
        // 模型单位：hx/hz ∈ [-1,1]（乘以 RAD），hy ∈ [-0.5,0.5]（乘以 HGT）
        const mx = p.hx * RAD;
        const mz = p.hz * RAD;
        const my = p.hy * HGT;
        // 绕 Y 轴旋转
        const x1 = mx * cos - mz * sin;
        const z1 = mx * sin + mz * cos;
        // 绕 Z 轴倾斜（此时 x/y 同尺度，倾斜才不会变形）
        const px3 = x1 * cosZ - my * sinZ;
        const py3 = x1 * sinZ + my * cosZ;

        const k = persp / (persp - z1);
        const homeX = cx + px3 * base * k;
        const homeY = cy + py3 * base * k;

        let px = homeX + p.ox;
        let py = homeY + p.oy;

        let ax = 0;
        let ay = 0;
        if (pointer.active) {
          const dx = px - pointer.x;
          const dy = py - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            const mag = K / (d2 + SOFT * SOFT);
            const d = Math.sqrt(d2) || 1;
            const edge = 1 - d2 / R2;
            ax += (dx / d) * mag * edge;
            ay += (dy / d) * mag * edge;
          }
        }
        ax += OMEGA * OMEGA * (homeX - px) - 2 * ZETA * OMEGA * p.vx;
        ay += OMEGA * OMEGA * (homeY - py) - 2 * ZETA * OMEGA * p.vy;

        p.vx = (p.vx + ax * dt) * dragK;
        p.vy = (p.vy + ay * dt) * dragK;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 3600) {
          p.vx = (p.vx / sp) * 3600;
          p.vy = (p.vy / sp) * 3600;
        }
        p.ox += p.vx * dt;
        p.oy += p.vy * dt;
        px = homeX + p.ox;
        py = homeY + p.oy;

        const depth = Math.min(1, Math.max(0, (z1 + 1) / 2));
        const glow = p.tint === 0 ? SPR.glowBlue : p.tint === 1 ? SPR.glowCyan : SPR.glowAmber;
        const bead = p.tint === 0 ? SPR.beadBlue : p.tint === 1 ? SPR.beadCyan : SPR.beadAmber;

        // 0.034 × base(~192) ≈ 15px 直径的珠子，才看得出是"球"
        const bs = p.size * k * base * 0.034 * (0.62 + depth * 0.55);
        if (bs <= 0.2) continue;

        // ① 光晕（加法，负责"发光"）
        const gs = bs * (2.2 + depth * 1.0);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (p.tint === 2 ? 0.12 : 0.16) + depth * 0.2;
        ctx.drawImage(glow, px - gs / 2, py - gs / 2, gs, gs);

        // ② 珠体（普通混合，负责"颗粒分明"）
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.55 + depth * 0.45;
        ctx.drawImage(bead, px - bs / 2, py - bs / 2, bs, bs);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (now: number) => {
      if (last) dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      angle += 0.0026 * (dt * 60);
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
