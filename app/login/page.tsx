"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAccount } from "@/lib/auth/account-client";

// three.js 只在浏览器跑：动态加载，避免进服务端渲染，也不拖慢首屏 HTML。
const DnaScene3D = dynamic(() => import("@/components/home/DnaScene3D").then((m) => m.DnaScene3D), {
  ssr: false,
});

/**
 * 登录页（站点入口）。
 *
 * 版式不是"左图右卡"那种常规分栏，而是杂志式非对称：
 *  - DNA 作为整屏背景，从左后方穿过；
 *  - 超大标题压在左上，留出大块空白；
 *  - 登录卡悬浮在右下，白底实心，压在 DNA 之上形成层次；
 *  - 底部一条贯穿全宽的指标带，把价值量化成三个数字。
 * 窄屏自动退化为单列（标题 → 卡片 → 指标）。
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, ready, login, register } = useAccount();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * 渐进展开：进门只有品牌和一个按钮；指针靠近（或键盘聚焦、触屏点开）后，
   * 标题 / 对角切割 / DNA / 登录卡 / 指标带依次浮现。
   *
   * 几个必须处理好的边界：
   *  - 触屏没有 hover：直接展开，否则用户会卡在一个"打不开"的页面；
   *  - 减少动效：直接展开；
   *  - 展开后不回缩：来回开关会闪，且没有功能价值。
   */
  const [expanded, setExpanded] = useState(false);
  const pageRef = useRef<HTMLElement | null>(null);

  /**
   * 视差：把指针的相对位置写进 CSS 变量，各层用不同系数取用。
   * 背景光斑动得少、DNA 动得多、卡片只微微倾斜 —— 这是最强的纵深线索。
   */
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--px", nx.toFixed(3));
      el.style.setProperty("--py", ny.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = window.requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (ready && user) router.replace("/chat");
  }, [user, ready, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const noHover = window.matchMedia("(hover: none)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noHover || reduce) {
      setExpanded(true);
      return;
    }
    if (expanded) return; // 已展开就不再监听，避免无意义的重复 setState
    // 指针靠近屏幕中心就展开（不需要瞄准按钮）
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - window.innerWidth / 2;
      const dy = e.clientY - window.innerHeight / 2;
      if (Math.hypot(dx, dy) < 260) setExpanded(true);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [expanded]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password);
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message || "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      ref={pageRef}
      className={`login-page ${expanded ? "is-expanded" : "is-collapsed"}`}
      onClick={() => setExpanded(true)}
    >
      {/* 对角切割：左下浅蓝三角 + 一条发丝线 */}
      <div className="login-diagonal" aria-hidden="true" />
      {/* 背景动效：漂移的极光 + 缓慢流动的点阵 */}
      <div className="login-aurora" aria-hidden="true">
        <span className="login-blob login-blob-1" />
        <span className="login-blob login-blob-2" />
        <span className="login-blob login-blob-3" />
      </div>
      <div className="login-grid" aria-hidden="true" />
      {/* 展开瞬间沿对角线扫过的一道高光 */}
      <div className="login-sweep" aria-hidden="true" />
      <svg
        className="login-diagonal-line"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1="12"
          x2="100"
          y2="100"
          stroke="rgba(26, 111, 181, 0.2)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* 沿切割线缓慢滑动的光点：让这条线活起来 */}
        <line
          className="login-diagonal-spark"
          x1="0"
          y1="12"
          x2="100"
          y2="100"
          stroke="rgba(26, 111, 181, 0.55)"
          strokeWidth="1.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength="100"
        />
      </svg>
      <div className="login-stage">
        <DnaScene3D />
      </div>

      <header className="login-topbar">
        <span className="login-brand">
          <span className="login-brand-dot" aria-hidden="true" />
          家系 ClearMind
        </span>
        <span className="login-topmeta">传智杯 · AI 健康与生活服务</span>
      </header>

      {/* 撕裂幕布：上下两块共享同一条对角线边缘，展开时分别朝右上 / 左下推开 */}
      <div className="login-tear" aria-hidden="true">
        <div className="login-tear-half login-tear-upper" />
        <div className="login-tear-half login-tear-lower" />
      </div>

      {/* 折叠态：入口是那道「光缝」本身，而不是一个按钮 */}
      <div className="login-seam-entry">
        <button
          type="button"
          className="login-seam-btn"
          onClick={() => setExpanded(true)}
          onFocus={() => setExpanded(true)}
          aria-label="展开登录界面"
        >
          <span className="login-seam-line" aria-hidden="true" />
        </button>
        <p className="login-seam-hint">
          <span className="login-seam-dot" aria-hidden="true" />
          靠近，或点击任意处
        </p>
      </div>

      <section className="login-hero">
        <p className="login-kicker">遗传健康的家族史梳理</p>
        <h1 className="login-title">
          你的风险里，
          <br />
          <em>有多少能拿回来</em>
        </h1>
        {/* 两处换行是有意的：避免自动折行把「家系图」拆成两行 */}
        <p className="login-sub">
          说出家里人的病史，我们整理成家系图，
          <br />
          再算清哪部分风险能靠生活方式拿回来。
        </p>
      </section>

      <section className="login-card-wrap">
        <div className="login-card">
          <div className="login-card-head">
            <h2 className="login-card-title">{mode === "login" ? "登录" : "创建账户"}</h2>
            <span className="login-card-tag">本地数据库</span>
          </div>
          <p className="login-card-sub">
            账户只解决一件事：换电脑、清缓存以后，你的家系还在。数据不出这台机器。
          </p>

          <form onSubmit={submit} className="login-form">
            <label className="login-field">
              <span>用户名</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="2-32 位，中英文/数字/下划线"
              />
            </label>
            <label className="login-field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="至少 6 位"
              />
            </label>
            {mode === "register" && (
              <label className="login-field">
                <span>确认密码</span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
            )}

            {error && <p className="login-error">{error}</p>}

            <button
              type="submit"
              className="login-submit"
              disabled={busy || username.trim().length === 0 || password.length === 0}
            >
              {busy ? "请稍候…" : mode === "login" ? "登录" : "创建账户"}
            </button>
          </form>

          <div className="login-switch">
            {mode === "login" ? "还没有账户？" : "已经有账户？"}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "创建一个" : "去登录"}
            </button>
          </div>

          <p className="login-demo">
            只想看效果？<a href="/chat?demo=1">用预置家系直接浏览</a>
          </p>
        </div>
      </section>

      <footer className="login-stats-strip">
        <div className="login-stat">
          <b>25</b>
          <span>种疾病可识别</span>
        </div>
        <div className="login-stat">
          <b>2</b>
          <span>套指南方程</span>
        </div>
        <div className="login-stat">
          <b>100%</b>
          <span>本机推理</span>
        </div>
        <p className="login-stats-note">FINDRISC · China-PAR ｜ 数据保存在本机 MySQL，不上传</p>
      </footer>
    </main>
  );
}
