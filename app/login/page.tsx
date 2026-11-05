"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (ready && user) router.replace("/chat");
  }, [user, ready, router]);

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
    <main className="login-page">
      {/* 对角切割：左下浅蓝三角 + 一条发丝线 */}
      <div className="login-diagonal" aria-hidden="true" />
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

      <section className="login-hero">
        <p className="login-kicker">遗传健康的家族史梳理</p>
        <h1 className="login-title">
          你的风险里，
          <br />
          <em>有多少能拿回来</em>
        </h1>
        <p className="login-sub">
          把家里人的病史说一遍，我们整理成家系图，
          算清哪部分风险能靠生活方式拿回来。
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
