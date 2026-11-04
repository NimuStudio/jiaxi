import Link from "next/link";
import { ReclaimSimulator } from "@/components/simulator/ReclaimSimulator";

export default function Home() {
  return (
    <main className="page">
      <header className="head">
        <span className="brand">
          <span className="brand-mark" />
          家系
        </span>
        <span className="tagline">你的风险里，有多少能拿回来</span>
        <Link className="head-link" href="/chat">
          先梳理家系 →
        </Link>
      </header>

      <ReclaimSimulator />

      <p className="foot-note">
        评分模型 FINDRISC（Lindström &amp; Tuomilehto, Diabetes Care 2003）；
        本实现采用 8 条目、0–26 分的现行版本，风险分层与风险值依据见
        <code>docs/references.md</code>。本页面为演示，不构成医疗建议。
      </p>
    </main>
  );
}
