"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * 登录页 DNA：three.js 真 3D。
 *
 * 为什么换掉 canvas 2D：参考图的关键不是"粒子"，是**光照**——
 * 球体有高光、暗部、以及泛光溢出。2D 贴图模拟不出这些，只能靠 three.js。
 *
 * 组成：
 *  - 核苷酸：InstancedMesh 球体（蓝 / 青两组材质，带自发光）；
 *  - 碱基对：InstancedMesh 圆柱（琥珀 / 蓝交替），按两根链的连线定位、定向；
 *  - 光照：环境光 + 三盏点光（冷白主光、青色补光、暖色轮廓光）；
 *  - 后期：UnrealBloom 泛光 + ACES 色调映射；
 *  - 交互：鼠标附近的球被推开，弹簧回位。
 *
 * 性能：实例化绘制（3 次 draw call 搞定上百个球/柱），像素比上限 1.75，
 * 页面隐藏即停，组件卸载时彻底 dispose。
 */
export function DnaScene3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const PAIRS = 56;
    const TURNS = 1.55;
    const RAD = 0.98;
    const HGT = 4.9;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xeef5fc, 0.018);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.1, 15.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.z = -0.3;
    // 上移一点：螺旋的下端不要压到左下的标题文字
    group.position.y = 0.42;
    scene.add(group);

    // ---- 几何：两条链的球心 ----
    const A: THREE.Vector3[] = [];
    const B: THREE.Vector3[] = [];
    for (let i = 0; i < PAIRS; i++) {
      const t = (i / PAIRS) * Math.PI * 2 * TURNS;
      const y = HGT * (i / (PAIRS - 1) - 0.5);
      A.push(new THREE.Vector3(Math.cos(t) * RAD, y, Math.sin(t) * RAD));
      B.push(new THREE.Vector3(Math.cos(t + Math.PI) * RAD, y, Math.sin(t + Math.PI) * RAD));
    }

    const sphereGeo = new THREE.SphereGeometry(1, 18, 14);
    const matA = new THREE.MeshStandardMaterial({
      color: 0x3d8fdd, emissive: 0x14497f, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.18,
    });
    const matB = new THREE.MeshStandardMaterial({
      color: 0x22c3d4, emissive: 0x0a5b66, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.18,
    });
    const meshA = new THREE.InstancedMesh(sphereGeo, matA, PAIRS);
    const meshB = new THREE.InstancedMesh(sphereGeo, matB, PAIRS);
    meshA.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    meshB.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const tmpM = new THREE.Matrix4();
    const quatId = new THREE.Quaternion();
    const scaleS = new THREE.Vector3(0.2, 0.2, 0.2);
    A.forEach((p, i) => {
      tmpM.compose(p, quatId, scaleS);
      meshA.setMatrixAt(i, tmpM);
    });
    B.forEach((p, i) => {
      tmpM.compose(p, quatId, scaleS);
      meshB.setMatrixAt(i, tmpM);
    });
    group.add(meshA, meshB);

    // ---- 碱基对：圆柱横档 ----
    const rungGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8, 1, false);
    const matAmber = new THREE.MeshStandardMaterial({
      color: 0xd79a52, emissive: 0x5c3a10, emissiveIntensity: 0.3, roughness: 0.44, metalness: 0.2,
    });
    const matRungBlue = new THREE.MeshStandardMaterial({
      color: 0x4a90d0, emissive: 0x163d63, emissiveIntensity: 0.28, roughness: 0.44, metalness: 0.2,
    });
    const half = Math.floor(PAIRS / 2);
    const rungAmber = new THREE.InstancedMesh(rungGeo, matAmber, half);
    const rungBlue = new THREE.InstancedMesh(rungGeo, matRungBlue, PAIRS - half);
    group.add(rungAmber, rungBlue);

    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const q = new THREE.Quaternion();
    let ai = 0;
    let bi = 0;
    for (let i = 0; i < PAIRS; i++) {
      const pa = A[i];
      const pb = B[i];
      if (!pa || !pb) continue;
      mid.addVectors(pa, pb).multiplyScalar(0.5);
      dir.subVectors(pb, pa);
      const len = dir.length();
      dir.normalize();
      q.setFromUnitVectors(up, dir);
      tmpM.compose(mid, q, new THREE.Vector3(1, len, 1));
      if (i % 2 === 0) rungAmber.setMatrixAt(ai++, tmpM);
      else rungBlue.setMatrixAt(bi++, tmpM);
    }

    // ---- 光照 ----
    scene.add(new THREE.AmbientLight(0x9dc2e4, 0.5));
    const key = new THREE.PointLight(0xdceeff, 42, 40, 2);
    key.position.set(3.6, 4.6, 6.4);
    const fill = new THREE.PointLight(0x2fd6e0, 32, 40, 2);
    fill.position.set(-4.6, -2.6, 4.6);
    const rim = new THREE.PointLight(0xffc48a, 20, 40, 2);
    rim.position.set(4.6, -3.4, -4.2);
    scene.add(key, fill, rim);

    // ---- 后期：泛光 ----
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.55, 0.8);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---- 物理：每个球的偏移与速度（局部坐标）----
    const offsets: THREE.Vector3[] = Array.from({ length: PAIRS * 2 }, () => new THREE.Vector3());
    const vels: THREE.Vector3[] = Array.from({ length: PAIRS * 2 }, () => new THREE.Vector3());

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

    const pointer = { x: -9999, y: -9999, active: false };
    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const clock = new THREE.Clock();
    const worldPos = new THREE.Vector3();
    const toCam = new THREE.Vector3();
    const scratch = new THREE.Vector3();
    const push = new THREE.Vector3();
    const invQ = new THREE.Quaternion();
    const R_PX = 92;

    let raf = 0;
    const frame = () => {
      const dt = Math.min(0.05, clock.getDelta());
      if (!reduce) group.rotation.y += 0.22 * dt;

      group.updateMatrixWorld();
      invQ.copy(group.quaternion).invert();

      for (let i = 0; i < PAIRS; i++) {
        for (let s = 0; s < 2; s++) {
          const base = s === 0 ? A[i] : B[i];
          const mesh = s === 0 ? meshA : meshB;
          if (!base) continue;
          const idx = s === 0 ? i : PAIRS + i;
          const off = offsets[idx];
          const vel = vels[idx];
          if (!off || !vel) continue;

          // 该球当前的世界位置 → 屏幕坐标
          worldPos.copy(base).add(off).applyMatrix4(group.matrixWorld);
          toCam.copy(worldPos).project(camera);
          const sx = (toCam.x * 0.5 + 0.5) * width;
          const sy = (-toCam.y * 0.5 + 0.5) * height;

          if (pointer.active) {
            const dx = sx - pointer.x;
            const dy = sy - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < R_PX * R_PX) {
              const d = Math.sqrt(d2) || 1;
              const mag = (1 - d / R_PX) ** 2 * 42;
              // 屏幕位移 → 相机平面方向
              push.set(dx / d, -dy / d, 0).applyQuaternion(camera.quaternion);
              push.applyQuaternion(invQ); // 转到 group 局部坐标
              vel.addScaledVector(push, mag * dt);
            }
          }

          // 弹簧回位 + 阻尼
          vel.addScaledVector(off, -26 * dt);
          vel.multiplyScalar(Math.exp(-4.2 * dt));
          off.addScaledVector(vel, dt);

          scratch.copy(base).add(off);
          tmpM.compose(scratch, quatId, scaleS);
          mesh.setMatrixAt(i, tmpM);
        }
      }
      meshA.instanceMatrix.needsUpdate = true;
      meshB.instanceMatrix.needsUpdate = true;

      composer.render();
      raf = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (reduce) {
        composer.render();
        return;
      }
      raf = window.requestAnimationFrame(frame);
    };

    const onVis = () => {
      if (reduce) return;
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = window.requestAnimationFrame(frame);
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVis);
    start();

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      composer.dispose();
      renderer.dispose();
      sphereGeo.dispose();
      rungGeo.dispose();
      matA.dispose();
      matB.dispose();
      matAmber.dispose();
      matRungBlue.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="dna-scene3d" aria-hidden="true" />;
}
