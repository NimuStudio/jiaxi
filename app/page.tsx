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
      </header>

      <ReclaimSimulator />

      <p className="foot-note">
        评分模型 FINDRISC（Lindström &amp; Tuomilehto, Diabetes Care 2003），
        风险分层参照 Lindström 2010。本页面为演示，不构成医疗建议。
      </p>
    </main>
  );
}
