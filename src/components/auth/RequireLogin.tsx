"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "@/lib/auth/account-client";

/**
 * 未登录时把访客送到登录页。
 *
 * 例外：带 ?demo=1 时放行——评审/老师需要免登录看到预置家系，
 * 这个入口在 README 里是对外承诺过的，不能被登录墙挡掉。
 */
export function RequireLogin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, ready } = useAccount();
  /**
   * 演示态在同一次浏览会话内保持：从 /chat?demo=1 点导航跳去 /（糖尿病风险页）时，
   * 新路由不再带 ?demo=1，原来的判断会立刻把人送回登录页 —— 这是评审会踩的坑。
   * 因此落地过任何 ?demo=1 就记进 sessionStorage，关掉标签页即失效。
   */
  const [demoSession, setDemoSession] = useState(false);

  useEffect(() => {
    try {
      if (params.get("demo") === "1") {
        sessionStorage.setItem("pedigree-demo", "1");
        setDemoSession(true);
      } else {
        setDemoSession(sessionStorage.getItem("pedigree-demo") === "1");
      }
    } catch {
      /* 隐私模式下 sessionStorage 不可用：退回只看 URL 参数 */
    }
  }, [params]);

  const demo = params.get("demo") === "1" || demoSession;
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user && !demo) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [user, ready, demo, router]);

  if (demo) return <>{children}</>;
  if (!checked) return null;
  return <>{children}</>;
}
