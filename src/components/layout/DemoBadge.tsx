"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 「演示模式」标记。
 *
 * 从 ?demo=1 进入后，会话里会留着 pedigree-demo 标记（见 RequireLogin / chat 页），
 * 这时每页都该说明「看到的是预置数据」——否则用户会以为那是自己的档案。
 */
export function DemoBadge() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);

  useEffect(() => {
    function sync() {
      try {
        if (new URLSearchParams(window.location.search).get("demo") === "1") {
          sessionStorage.setItem("pedigree-demo", "1");
        }
        setOn(sessionStorage.getItem("pedigree-demo") === "1");
      } catch {
        setOn(false);
      }
    }
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname]);

  if (!on) return null;

  return (
    <span
      className="demo-badge"
      title="当前显示的是预置演示数据，不会写入或覆盖你的档案"
    >
      <span className="demo-badge-dot" aria-hidden="true" />
      演示模式
    </span>
  );
}
