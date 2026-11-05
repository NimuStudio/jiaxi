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
   * 只认 URL 上的 ?demo=1，不认会话标记。
   *
   * 之前用 sessionStorage 记住演示态，结果是「只要访问过演示，之后直接输网址也免登录」——
   * 这会让登录墙形同虚设。现在演示态由链接自己携带：演示中点击导航时，
   * AppShell 会给目标地址补上 ?demo=1（见 AppShell 里的 withDemo）。
   */
  useEffect(() => {
    try {
      if (params.get("demo") === "1") sessionStorage.setItem("pedigree-demo", "1");
    } catch {
      /* 隐私模式下不可用，仅影响「演示模式」标记，不影响放行判断 */
    }
  }, [params]);

  const demo = params.get("demo") === "1";
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user && !demo) {
      // 带上原目标：从别人分享的链接进来，登录后应该回到那一页，而不是一律 /chat
      const here = window.location.pathname + window.location.search;
      router.replace(here.startsWith("/login") ? "/login" : `/login?next=${encodeURIComponent(here)}`);
      return;
    }
    setChecked(true);
  }, [user, ready, demo, router]);

  if (demo) return <>{children}</>;
  if (!checked) return null;
  return <>{children}</>;
}
