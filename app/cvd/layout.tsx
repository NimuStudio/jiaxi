import { Suspense } from "react";
import { RequireLogin } from "@/components/auth/RequireLogin";

/**
 * 与首页同一道登录墙：未登录访问先到 /login（评审/老师走 ?demo=1 时放行）。
 * 之前只有 / 包了 RequireLogin，/chat 与 /cvd 可以直接进，口径不一致。
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RequireLogin>{children}</RequireLogin>
    </Suspense>
  );
}
