import Link from "next/link";

/**
 * 自定义 404。
 *
 * 为什么需要：站点重新构建后，先前打开着的标签页会去取旧版本的资源，
 * 取不到时 Next 会渲染默认的英文 404（This page could not be found.），
 * 看起来像"产品挂了"。这里给一个能自救的中文页面。
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 44, fontWeight: 700, margin: 0, color: "#111827" }}>404</p>
      <p style={{ margin: 0, color: "#374151", lineHeight: 1.8 }}>
        这个地址没有内容。
        <br />
        如果你刚才还开着页面，可能是站点刚更新过——刷新一下即可。
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
        <a
          href=""
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.14)",
            textDecoration: "none",
            color: "#111827",
          }}
        >
          刷新当前页
        </a>
        <Link
          href="/chat"
          style={{
            padding: "8px 16px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.14)",
            textDecoration: "none",
            color: "#111827",
          }}
        >
          回到梳理家系
        </Link>
      </div>
    </main>
  );
}
