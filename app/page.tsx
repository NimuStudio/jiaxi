import { Suspense } from "react";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { EvidencePanel } from "@/components/rag/EvidencePanel";
import { ReclaimSimulator } from "@/components/simulator/ReclaimSimulator";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <RequireLogin>
        <main className="page">
          <div className="page-head">
            <h1 className="page-title">你的风险里，有多少能拿回来</h1>
            <p className="page-sub">
              FINDRISC 把 10 年糖尿病风险拆成「改不了的」和「能拿回来的」——拖动滑块，看后一部分值多少分。
            </p>
          </div>

          <ReclaimSimulator />
          <EvidencePanel />

          <p className="foot-note">
            评分模型 FINDRISC（Lindström &amp; Tuomilehto, Diabetes Care 2003）；
            本实现采用 8 条目、0–26 分的现行版本，风险分层与风险值依据见
            <code>docs/references.md</code>。本页面为演示，不构成医疗建议。
          </p>
        </main>
      </RequireLogin>
    </Suspense>
  );
}
