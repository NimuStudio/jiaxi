import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "家系 · 你的风险里，有多少能拿回来",
  description:
    "把家族病史整理成一张家系图，算出你的风险里哪些改不了、哪些能拿回来，并给出这周就能做的一步。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning 只作用在 <html> 这一个元素的属性比对。
    // 加它的原因：部分浏览器扩展（远程控制、屏幕共享、安全插件）会在
    // React 加载前往 <html> 上注入自己的属性（如 __gcrremoteframetoken），
    // 导致服务端与客户端 HTML 不一致而整页报错。这不影响页面内容，
    // 但会让演示时满屏红字，所以在这一层抑制掉。
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
