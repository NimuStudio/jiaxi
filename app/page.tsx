import { Suspense } from "react";
import Link from "next/link";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { EvidencePanel } from "@/components/rag/EvidencePanel";
import { ReclaimSimulator } from "@/components/simulator/ReclaimSimulator";
import { FirstRunGuide } from "@/components/onboarding/FirstRunGuide";

export default function Home({
  searchParams,
}: {
  searchParams?: { demo?: string };
}) {
  const demo = searchParams?.demo === "1";
  return (
    <Suspense fallback={null}>
      <RequireLogin>
        <main className="page">
          <div className="page-head">
            <h1 className="page-title">把家里人的病史，变成能看懂的风险</h1>
            <p className="page-sub">
              说出家里谁得过什么病，我们理成家系图，再用三套公开模型算你的风险——
              并且拆出哪一部分是你能拿回来的。
            </p>
            <div className="page-cta-row">
              <Link className="page-cta" href={demo ? "/chat?demo=1" : "/chat"}>
                梳理我的家系
              </Link>
              <Link className="page-cta is-ghost" href={demo ? "/lung?demo=1" : "/lung"}>
                先看一套模型怎么算
              </Link>
            </div>
          </div>

          <FirstRunGuide demo={demo} />

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
