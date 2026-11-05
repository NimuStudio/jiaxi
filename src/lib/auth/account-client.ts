"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 客户端账户状态（会话 cookie 驱动）。
 *
 * 登录态的跨组件通知用 window 自定义事件（pedigree:auth）：
 * 应用壳里的登录弹层与页面里的数据同步逻辑解耦——
 * 弹层不关心数据，页面不关心表单，只认「登录/登出发生了」。
 */

export interface AccountUser {
  id: number;
  username: string;
}

/** 登录/登出事件的统一名与载荷。 */
export const AUTH_EVENT = "pedigree:auth";
export type AuthEventDetail = { type: "login"; user: AccountUser } | { type: "logout" };

export function emitAuth(detail: AuthEventDetail) {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail }));
}

export function useAccount() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: AccountUser | null }) => {
        if (alive) {
          setUser(d.user ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 弹层登录/登出时，其他已挂载的 useAccount 也要跟着变
  useEffect(() => {
    function onAuth(e: Event) {
      const detail = (e as CustomEvent<AuthEventDetail>).detail;
      if (detail.type === "login") setUser(detail.user);
      else setUser(null);
    }
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json()) as { user?: AccountUser; error?: string };
    if (!res.ok) throw new Error(data.error ?? "登录失败");
    setUser(data.user ?? null);
    emitAuth({ type: "login", user: data.user as AccountUser });
    return data.user as AccountUser;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json()) as { user?: AccountUser; error?: string };
    if (!res.ok) throw new Error(data.error ?? "注册失败");
    setUser(data.user ?? null);
    emitAuth({ type: "login", user: data.user as AccountUser });
    return data.user as AccountUser;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    emitAuth({ type: "logout" });
  }, []);

  return { user, ready, login, register, logout };
}
