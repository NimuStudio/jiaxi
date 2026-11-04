import type { Metadata } from "next";
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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
