"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { DemoBadge } from "@/components/layout/DemoBadge";

/**
 * 全局应用壳：一条悬浮的圆角玻璃导航条 + 流动光斑背景。
 *
 * 之前顶栏和侧边栏各自渲染同一组导航（功能完全重复），现在合并成一条：
 *  - 顶栏是悬浮的四圆角玻璃面板，与内容卡片的圆角/玻璃质感一致；
 *  - 「01 / 02 / 03」工作流编号并进导航胶囊，导航自己讲一遍使用顺序；
 *  - 右侧保留 AI 在线状态；引擎标注 FINDRISC · China-PAR 也收进这里。
 */

const iconStroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const NAV = [
  {
    href: "/chat",
    step: "01",
    label: "梳理家系",
    hint: "说出来，画出来",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...iconStroke}>
        <rect x="9" y="2.5" width="6" height="5" rx="1.2" />
        <rect x="2" y="16.5" width="6" height="5" rx="1.2" />
        <rect x="16" y="16.5" width="6" height="5" rx="1.2" />
        <path d="M12 7.5v4M5 16.5V14h14v2.5M12 11.5V14" />
      </svg>
    ),
  },
  {
    href: "/",
    step: "02",
    label: "糖尿病风险",
    hint: "可回收风险",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...iconStroke}>
        <path d="M12 3c3.5 4 6 6.8 6 10a6 6 0 1 1-12 0c0-3.2 2.5-6 6-10z" />
        <path d="M9.5 13.5a2.5 2.5 0 0 0 2.5 2.5" />
      </svg>
    ),
  },
  {
    href: "/cvd",
    step: "03",
    label: "心血管风险",
    hint: "China-PAR 方程",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" {...iconStroke}>
        <path d="M3 12h3l1.8-4 3 8 2.2-9 2 5h6" />
      </svg>
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  /** 登录页是独立入口，不套全站导航（否则一进门就看见仪表盘式顶栏，很怪） */
  const barePage = pathname === "/login";

  // 探测一次本地推理服务状态，顶栏右侧显示在线状态。
  // 顶栏不依赖这个状态渲染，探测失败只显示「离线」，不阻塞页面。
  useEffect(() => {
    let alive = true;
    fetch("/api/extract")
      .then((r) => r.json())
      .then((d: { ready?: boolean }) => {
        if (alive) setLlmReady(Boolean(d.ready));
      })
      .catch(() => {
        if (alive) setLlmReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * 演示态：给导航链接补上 ?demo=1。
   *
   * 登录墙只认 URL 参数（不认会话标记，否则访问过一次演示就等于永久免登录），
   * 所以演示中点击导航时必须由链接自己把参数带过去，否则会被送回登录页。
   */
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("demo") === "1") {
        sessionStorage.setItem("pedigree-demo", "1");
      }
      setDemo(sessionStorage.getItem("pedigree-demo") === "1");
    } catch {
      setDemo(false);
    }
  }, [pathname]);

  const withDemo = (href: string) => (demo ? `${href}?demo=1` : href);

  // 登录页：不套光斑背景、不套顶栏，整屏交给登录页自己
  if (barePage) return <>{children}</>;

  return (
    <>
      {/* 光斑背景：纯 CSS，动画只动 transform（性能优先） */}
      <div className="bg-scene" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
      </div>

      <header className="topbar">
        <div className="topbar-left">
          <Link href={withDemo("/chat")} className="topbar-logo">
            <span className="brand-mark" />
            家系
          </Link>
          <span className="topbar-tagline">你家的病史，画出来才看得见</span>
        </div>

        <nav className="topbar-nav" aria-label="主导航">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={withDemo(item.href)}
              className={`topbar-nav-btn${pathname === item.href ? " active" : ""}`}
              title={item.hint}
            >
              <span className="topbar-nav-step">{item.step}</span>
              <span className="topbar-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-right">
          <DemoBadge />
          <span className="topbar-engines">FINDRISC · China-PAR</span>
          <span
            className={`topbar-status${llmReady ? " is-on" : ""}`}
            title="本地大模型推理 · 家族信息不出机器"
          >
            <span className="topbar-status-dot" />
            {llmReady === null ? "AI 检测中" : llmReady ? "本地推理在线" : "AI 离线·仅评审时段"}
          </span>
          <AuthPanel />
        </div>
      </header>

      <main className="app-main">{children}</main>

      {/* 梳理家系页是「一屏工作台」（整页不滚动），页脚会把它顶出一屏，故隐藏；
          隐私说明该页已由 AI 状态横幅承担。 */}
      {pathname !== "/chat" && (
        <p className="app-foot">
          本地推理 · 家族信息不出机器 · 引擎：FINDRISC（Diabetes Care 2003）/ China-PAR（Circulation 2016）
        </p>
      )}
    </>
  );
}
