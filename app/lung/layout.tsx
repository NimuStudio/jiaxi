import { Suspense } from "react";
import { RequireLogin } from "@/components/auth/RequireLogin";

/** 与首页、/cvd 同一道登录墙；?demo=1 时放行（评审/老师走这条）。 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RequireLogin>{children}</RequireLogin>
    </Suspense>
  );
}
