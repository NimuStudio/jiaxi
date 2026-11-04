"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PedigreeGraph } from "@/components/pedigree/PedigreeGraph";
import type { ExtractedPerson } from "@/lib/extract/client";

/**
 * 演示用家系数据。访问 /chat?demo=1 直接加载，
 * 便于录制演示视频、以及在不依赖模型的情况下调试图的渲染。
 */
const DEMO: ExtractedPerson[] = [
  {
    relation: "paternal-grandfather",
    sex: "male",
    conditions: [{ code: "type2-diabetes", onsetAge: null }],
  },
  {
    relation: "paternal-grandmother",
    sex: "female",
    conditions: [{ code: "hypertension", onsetAge: null }],
  },
  {
    relation: "father",
    sex: "male",
    conditions: [{ code: "myocardial-infarction", onsetAge: 52 }],
  },
  { relation: "mother", sex: "female", conditions: [] },
  {
    relation: "maternal-grandmother",
    sex: "female",
    conditions: [{ code: "stroke", onsetAge: 68 }],
  },
  {
    relation: "maternal-uncle",
    sex: "male",
    conditions: [{ code: "type2-diabetes", onsetAge: 45 }],
  },
  { relation: "self", sex: "male", conditions: [] },
];

/**
 * 合并多次抽取结果。
 * 同一亲属可能被多段话提到（先说父亲心梗、后说父亲糖尿病），
 * 需要合并到同一个节点上，而不是覆盖或重复。
 */
function mergePersons(
  current: ExtractedPerson[],
  incoming: ExtractedPerson[],
): ExtractedPerson[] {
  const map = new Map(
    current.map((p) => [p.relation, { ...p, conditions: [...p.conditions] }]),
  );

  for (const p of incoming) {
    const existing = map.get(p.relation);
    if (!existing) {
      map.set(p.relation, { ...p, conditions: [...p.conditions] });
      continue;
    }
    for (const c of p.conditions) {
      const dup = existing.conditions.some(
        (d) => d.code === c.code && d.onsetAge === c.onsetAge,
      );
      if (!dup) existing.conditions.push(c);
    }
  }

  return [...map.values()];
}

export default function ChatPage() {
  const [persons, setPersons] = useState<ExtractedPerson[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // 演示模式：/chat?demo=1 直接填好一整套家系，方便录制与调试图的渲染。
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setPersons(DEMO);
      setLastAdded("maternal-uncle");
    }
  }, []);

  return (
    <main className="page page-wide">
      <header className="head">
        <span className="brand">
          <span className="brand-mark" />
          家系
        </span>
        <span className="tagline">你家的病史，画出来才看得见</span>
        <Link className="head-link" href="/">
          看风险量化 →
        </Link>
      </header>

      <div className="workspace">
        <aside className="chat-side">
          <ChatPanel
            hasData={persons.length > 0}
            onExtracted={(incoming) => {
              setPersons((prev) => mergePersons(prev, incoming));
              setLastAdded(incoming[0]?.relation ?? null);
            }}
          />
        </aside>

        <section className="graph-side">
          <PedigreeGraph persons={persons} highlight={lastAdded} />
          <p className="graph-hint">
            方形为男性，圆形为女性，实心表示有该病记录。信息分批说也可以，图上会持续补充。
          </p>
        </section>
      </div>
    </main>
  );
}
