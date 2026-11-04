"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { PedigreeGraph } from "@/components/pedigree/PedigreeGraph";
import type { ExtractedPerson } from "@/lib/extract/client";
import { DISEASE_LABEL, RELATION_LABEL } from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";

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

/** 一级亲属：父母、子女、兄弟姐妹。 */
const FIRST_DEGREE = new Set([
  "father",
  "mother",
  "brother",
  "sister",
  "son",
  "daughter",
]);

/**
 * 从已梳理的家系里读出「糖尿病家族史」等级。
 *
 * FINDRISC 的家族史条目只关心糖尿病：一级亲属 5 分、二级亲属 3 分。
 * 这里把这件事从图里直接算出来，用户不必再回答一遍
 * 「你家里有没有人得糖尿病」——这是家系图对下游量化的直接贡献。
 */
function diabetesFamilyHistory(
  persons: ExtractedPerson[],
): "none" | "second" | "first" {
  const affected = persons.filter((p) =>
    p.conditions.some((c) => c.code === "type2-diabetes"),
  );
  if (affected.some((p) => FIRST_DEGREE.has(p.relation))) return "first";
  if (affected.length > 0) return "second";
  return "none";
}

const HISTORY_TEXT: Record<"none" | "second" | "first", string> = {
  none: "目前还没有记录到糖尿病家族史。",
  second: "有二级亲属患糖尿病（祖辈或叔姑舅姨），FINDRISC 记 3 分。",
  first:
    "有一级亲属患糖尿病（父母、兄弟姐妹或子女），FINDRISC 记 5 分——这是该量表里权重最高的一项。",
};

export default function ChatPage() {
  const [persons, setPersons] = useState<ExtractedPerson[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  /** 选中的节点（点开看依据、可删除）。 */
  const [selected, setSelected] = useState<string | null>(null);
  /** 每个亲属节点的来源原话，用于「依据」回溯。 */
  const [sources, setSources] = useState<Record<string, string[]>>({});

  // 演示模式：/chat?demo=1 直接填好一整套家系，方便录制与调试图的渲染。
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      setPersons(DEMO);
      setLastAdded(null);
      // 演示时默认选中一位，便于直接展示「依据」面板
      setSelected("paternal-grandfather");
    }
  }, []);

  const selectedPerson =
    persons.find((p) => p.relation === selected) ?? null;

  function removePerson(relation: string) {
    setPersons((prev) => prev.filter((p) => p.relation !== relation));
    setSources((prev) => {
      const next = { ...prev };
      delete next[relation];
      return next;
    });
    setSelected(null);
  }

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
            onExtracted={(incoming, source) => {
              setPersons((prev) => mergePersons(prev, incoming));
              setLastAdded(incoming[0]?.relation ?? null);
              setSources((prev) => {
                const next = { ...prev };
                for (const p of incoming) {
                  next[p.relation] = [...(next[p.relation] ?? []), source];
                }
                return next;
              });
            }}
          />
        </aside>

        <section className="graph-side">
          <PedigreeGraph
            persons={persons}
            highlight={lastAdded}
            selected={selected}
            onSelect={(relation) =>
              setSelected((cur) => (cur === relation ? null : relation))
            }
          />
          <p className="graph-hint">
            方形为男性，圆形为女性，实心表示有该病记录。点任意节点可查看依据、也可删改。
          </p>

          {selectedPerson && (
            <div className="evidence-panel">
              <div className="evidence-head">
                <span className="evidence-title">
                  {RELATION_LABEL[selectedPerson.relation as RelationType] ??
                    selectedPerson.relation}
                  {" · "}
                  {selectedPerson.conditions.length === 0
                    ? "未记录病名"
                    : selectedPerson.conditions
                        .map((c) => DISEASE_LABEL[c.code] ?? c.code)
                        .join("、")}
                </span>
                <button
                  type="button"
                  className="evidence-close"
                  onClick={() => setSelected(null)}
                >
                  收起
                </button>
              </div>

              <div className="evidence-sources">
                {(sources[selectedPerson.relation] ?? []).length > 0 ? (
                  <>
                    <span className="evidence-label">依据</span>
                    {(sources[selectedPerson.relation] ?? []).map((src, i) => (
                      <p key={i} className="evidence-quote">
                        「{src}」
                      </p>
                    ))}
                  </>
                ) : (
                  <p className="evidence-quote is-muted">
                    这是演示数据，没有对应的原话记录。你自己说过的句子会出现在这里。
                  </p>
                )}
              </div>

              <button
                type="button"
                className="evidence-remove"
                onClick={() => removePerson(selectedPerson.relation)}
              >
                这条不对，删掉
              </button>
            </div>
          )}

          {persons.length > 0 && (
            <div className="next-step">
              <div className="next-step-label">这些信息换来了什么</div>
              <p className="next-step-body">
                {HISTORY_TEXT[diabetesFamilyHistory(persons)]}
              </p>
              <Link className="next-step-cta" href="/">
                补几个体检数字，看“可回收风险” →
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
