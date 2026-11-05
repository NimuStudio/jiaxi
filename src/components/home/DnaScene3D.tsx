"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * 登录页 DNA：**全部由小粒子组成**的双螺旋（three.js）。
 *
 * 关键决定：
 *  - 链、横档都不用几何体，统一用 THREE.Points 画点 —— 一次 draw call 画上万颗；
 *  - 点贴图是程序生成的柔光圆点，additive 混合 + UnrealBloom 出泛光；
 *  - 颜色：两个链分别蓝 / 青，碱基对粒子用琥珀色，横向读得出来是"梯级"。
 *
 * 交互：鼠标附近的粒子被推开再弹回。为了性能，不在屏幕空间逐点投影，
 * 而是把鼠标反投影到 group 局部坐标，直接在 3D 里算距离（O(N) 纯算术）。
 */
export function DnaScene3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.1, 14.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.z = -0.08; // 只留一点点倾斜，保持螺旋可读
    group.position.y = 0.1;
    group.position.x = -0.35;
    scene.add(group);

    // ---- 粒子参数 ----
    const small = window.innerWidth < 820;
    const PER_TURN = small ? 260 : 460; // 每圈链上的粒子数
    const TURNS = 1.7;
    const PAIRS = small ? 40 : 66; // 横档数量
    const RUNG_DOTS = small ? 12 : 20; // 每根横档的粒子数
    const RAD = 1.18;
    const HGT = 5.0;

    const strandCount = Math.round(PER_TURN * TURNS);
    const total = strandCount * 2 + PAIRS * (RUNG_DOTS - 2);

    const positions = new Float32Array(total * 3);
    const colors = new Float32Array(total * 3);
    const base = new Float32Array(total * 3); // 家坐标（局部）
    const offsets = new Float32Array(total * 3);
    const vels = new Float32Array(total * 3);

    const cBlue = new THREE.Color(0x2f7cd6);
    const cCyan = new THREE.Color(0x18b8cc);
    const cAmber = new THREE.Color(0xefa85a);

    let p = 0;
    const put = (x: number, y: number, z: number, c: THREE.Color) => {
      const i3 = p * 3;
      base[i3] = x;
      base[i3 + 1] = y;
      base[i3 + 2] = z;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
      p++;
    };

    // ① 两条主链：密排小粒子（加一点径向抖动，像粒子云而不是细线）
    for (let i = 0; i < strandCount; i++) {
      const t = (i / strandCount) * Math.PI * 2 * TURNS;
      const y = HGT * (i / (strandCount - 1) - 0.5);
      // 径向 + 高度抖动：让链是"粒子云"而不是一根虚线
      const jr = 0.94 + Math.random() * 0.12;
      const jy = (Math.random() - 0.5) * 0.12;
      put(Math.cos(t) * RAD * jr, y + jy, Math.sin(t) * RAD * jr, cBlue);
      put(
        Math.cos(t + Math.PI) * RAD * (2 - jr),
        y - jy,
        Math.sin(t + Math.PI) * RAD * (2 - jr),
        cCyan,
      );
    }

    // ② 碱基对：每根横档由一串小粒子连成
    for (let k = 0; k < PAIRS; k++) {
      const t = (k / PAIRS) * Math.PI * 2 * TURNS;
      const y = HGT * (k / (PAIRS - 1) - 0.5);
      const ax = Math.cos(t) * RAD;
      const az = Math.sin(t) * RAD;
      const bx = Math.cos(t + Math.PI) * RAD;
      const bz = Math.sin(t + Math.PI) * RAD;
      const amber = k % 2 === 0;
      for (let d = 1; d <= RUNG_DOTS - 2; d++) {
        const s = d / (RUNG_DOTS - 1);
        put(
          ax + (bx - ax) * s,
          y + (Math.random() - 0.5) * 0.03,
          az + (bz - az) * s,
          amber ? cAmber : cBlue,
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    /** 程序生成的柔光圆点：中心亮、边缘透明 */
    const dotTexture = (() => {
      const size = 64;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d");
      if (g) {
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.35, "rgba(255,255,255,0.75)");
        grad.addColorStop(0.7, "rgba(255,255,255,0.22)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const mat = new THREE.PointsMaterial({
      size: 0.105,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    group.add(points);

    // ---- 后期泛光 ----
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.5, 0.22);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      bloom.resolution.set(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    // ---- 鼠标：反投影到 group 局部坐标 ----
    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    const localMouse = new THREE.Vector3();
    let mouseActive = false;
    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        localMouse.copy(group.worldToLocal(hit.clone()));
        mouseActive = true;
      }
    };
    const onLeave = () => {
      mouseActive = false;
    };

    const R3 = 1.15; // 局部空间的排斥半径
    const R3sq = R3 * R3;

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!reduce) group.rotation.y += 0.2 * dt;

      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const damp = Math.exp(-3.4 * dt);
      const spring = 26;

      for (let i = 0; i < total; i++) {
        const i3 = i * 3;
        const bx = base[i3] as number;
        const by = base[i3 + 1] as number;
        const bz = base[i3 + 2] as number;
        let ox = offsets[i3] as number;
        let oy = offsets[i3 + 1] as number;
        let oz = offsets[i3 + 2] as number;
        let vx = vels[i3] as number;
        let vy = vels[i3 + 1] as number;
        let vz = vels[i3 + 2] as number;

        if (mouseActive) {
          const dx = bx + ox - localMouse.x;
          const dy = by + oy - localMouse.y;
          const dz = bz + oz - localMouse.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < R3sq) {
            const d = Math.sqrt(d2) || 0.001;
            const mag = (1 - d / R3) ** 2 * 26;
            vx += (dx / d) * mag * dt;
            vy += (dy / d) * mag * dt;
            vz += (dz / d) * mag * dt;
          }
        }

        vx += -spring * ox * dt;
        vy += -spring * oy * dt;
        vz += -spring * oz * dt;
        vx *= damp;
        vy *= damp;
        vz *= damp;
        ox += vx * dt;
        oy += vy * dt;
        oz += vz * dt;

        offsets[i3] = ox;
        offsets[i3 + 1] = oy;
        offsets[i3 + 2] = oz;
        vels[i3] = vx;
        vels[i3 + 1] = vy;
        vels[i3 + 2] = vz;

        arr[i3] = bx + ox;
        arr[i3 + 1] = by + oy;
        arr[i3 + 2] = bz + oz;
      }
      pos.needsUpdate = true;

      composer.render();
      raf = window.requestAnimationFrame(frame);
    };

    if (reduce) composer.render();
    else raf = window.requestAnimationFrame(frame);

    const onVis = () => {
      if (reduce) return;
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      composer.dispose();
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      dotTexture.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="dna-scene3d" aria-hidden="true" />;
}
