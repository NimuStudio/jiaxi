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
  const demo = params.get("demo") === "1";
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
