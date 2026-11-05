"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DnaScene } from "@/components/home/DnaScene";
import { useAccount } from "@/lib/auth/account-client";

/**
 * 登录页（站点入口）。
 *
 * 左侧是 DNA 双螺旋：这是遗传健康产品的第一眼，比任何口号都直接。
 * 右侧是登录/注册二选一。注册的理由写清楚：账户只解决「数据跟着人走」，
 * 数据仍然存在本机，不出这台机器。
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

  // 已登录直接进站
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
      <section className="login-visual">
        <DnaScene />
        <div className="login-visual-copy">
          <p className="login-kicker">家系 · 遗传健康的家族史梳理</p>
          <h1 className="login-title">
            你的风险里，
            <br />
            <span className="login-title-accent">有多少能拿回来</span>
          </h1>
          <p className="login-sub">
            把家里人的病史说一遍，我们整理成家系图，算清哪部分风险能靠生活方式拿回来。
          </p>

          <ul className="login-stats">
            <li>
              <b>25</b>
              <span>种疾病可识别</span>
            </li>
            <li>
              <b>2</b>
              <span>套指南方程</span>
            </li>
            <li>
              <b>100%</b>
              <span>本机推理</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-brand-dot" aria-hidden="true" />
            <span>家系 ClearMind Pedigree</span>
          </div>
          <h2 className="login-card-title">{mode === "login" ? "登录" : "创建账户"}</h2>
          <p className="login-card-sub">
            账户只解决一件事：换电脑、清缓存以后，你的家系还在。
            数据存在本机数据库，不出这台机器。
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
            只想看效果？<a href="/chat?demo=1">用预置家系直接浏览</a>（不登录、不读写你的数据）
          </p>
        </div>
      </section>
    </main>
  );
}
