"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentPanel } from "@/components/agent/AgentPanel";
import { RiskFactorsForm } from "@/components/agent/RiskFactorsForm";
import type { RiskFactors } from "@/lib/agent/tools";
import { PedigreeGraph } from "@/components/pedigree/PedigreeGraph";
import type { ExtractedPerson } from "@/lib/extract/client";
import { DISEASE_LABEL, RELATION_LABEL } from "@/lib/pedigree/viz";
import { exposureHints } from "@/lib/risk/exposure";
import { familySignals } from "@/lib/risk/familySignals";
import type { RelationType } from "@/lib/pedigree/types";
import {
  AUTH_EVENT,
  type AuthEventDetail,
  type AccountUser,
} from "@/lib/auth/account-client";

/** 体检数字在 localStorage 里的键（与 RiskFactorsForm 的 STORAGE_KEY 一致）。 */
const FACTORS_KEY = "pedigree-risk-factors";

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
      // 与抽取层的合并规则一致：按病种去重，年龄取更具体的一方。
      const dup = existing.conditions.find((d) => d.code === c.code);
      if (!dup) {
        existing.conditions.push(c);
      } else if (dup.onsetAge === null && c.onsetAge !== null) {
        dup.onsetAge = c.onsetAge;
      }
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

/** China-PAR 的心血管病家族史：父母、兄弟姊妹中至少一人心梗或脑卒中。 */
const ASCVD_FIRST_DEGREE = new Set(["father", "mother", "brother", "sister"]);

function ascvdFamilyHistory(
  persons: ExtractedPerson[],
): Array<{ relation: string; condition: string }> {
  return persons
    .filter((p) => ASCVD_FIRST_DEGREE.has(p.relation))
    .flatMap((p) =>
      p.conditions
        .filter((c) => c.code === "myocardial-infarction" || c.code === "stroke")
        .map((c) => ({ relation: p.relation, condition: c.code })),
    );
}

/** 左栏的功能模式：录入家系 / Agent 问答。一次只显示一个面板，
 *  避免两段长面板叠在一列里把页面拉成「通天面板」。 */
type SideMode = "record" | "qa";

export default function ChatPage() {
  const [mode, setMode] = useState<SideMode>("record");
  const [persons, setPersons] = useState<ExtractedPerson[]>([]);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  /** 选中的节点（点开看依据、可删除）。 */
  const [selected, setSelected] = useState<string | null>(null);
  /** 每个亲属节点的来源原话，用于「依据」回溯。 */
  const [sources, setSources] = useState<Record<string, string[]>>({});
  /** 登录用户（null = 未登录，纯本地模式）。 */
  const [account, setAccount] = useState<AccountUser | null>(null);
  /** 体检数字的同步纪元：云端数据写回 localStorage 后 +1，触发表单重挂载。 */
  const [factorsEpoch, setFactorsEpoch] = useState(0);
  /**
   * 推理服务是否在线。null 表示还在探测。
   *
   * 部署到公网后，站点本身常驻服务器，但大模型跑在演示机上（本地推理，
   * 数据不出机器）。演示机关机时这条链路是断的，必须让访客知道
   * 「现在能用什么、不能用什么」，而不是让他在输入框里试出报错。
   */
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  /**
   * Agent 问答的体检数字（年龄、BMI、腰围……）。
   * 存在浏览器里，问答面板用它算风险；没填齐时 compute_risk 工具会如实说算不了。
   */
  const [factors, setFactors] = useState<RiskFactors | null>(null);
  /** 触发体检数字表单展开的信号（问答面板里点了「补几个数」）。 */
  const [factorsOpenSignal, setFactorsOpenSignal] = useState(0);

  // 探测推理服务是否在线
  useEffect(() => {
    let alive = true;
    fetch("/api/extract")
      .then((r) => r.json())
      .then((d: { ready?: boolean }) => {
        if (alive) setLlmReady(Boolean(d.ready));
      })
      .catch(() => {
        if (alive) setLlmReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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

  // 家系每次变化都同步到 localStorage，供 /cvd 读出心血管家族史。
  // 只存结构化结果（亲属+病名），原话仍只留在本页会话里。
  useEffect(() => {
    try {
      localStorage.setItem("pedigree-persons", JSON.stringify(persons));
    } catch {
      /* 存不进去不影响本页功能 */
    }
  }, [persons]);

  /* ---------- 账户与云端同步 ----------
   * 本地 localStorage 始终是工作副本（未登录也一切照旧）；
   * 登录后云端是持久层：先做一次双向对账（云端有→拉下来合并；
   * 云端空→把本地数据迁上去），之后每次变更自动备份。 */

  // 事件回调只注册一次，读到的必须是最新值 → 用 ref 转发
  const factorsRef = useRef(factors);
  factorsRef.current = factors;
  const personsRef = useRef(persons);
  personsRef.current = persons;

  /**
   * 对账完成标记。登录后必须先拉云端对账，之后的人员变更（**包括删空**）
   * 才自动备份。没有它会出现两种错：
   *  - 登录瞬间本地空数组抢先把云端覆盖；
   *  - 登录中把家系删空时不备份（旧代码 persons.length===0 直接 return），
   *    云端残留会在下次登录对账时「复活」已删除的节点。
   */
  const cloudSyncedRef = useRef(false);

  function syncFromCloud() {
    void (async () => {
      try {
        const [pedRes, facRes] = await Promise.all([
          fetch("/api/me/pedigree").then((r) => r.json() as Promise<{ persons?: ExtractedPerson[] }>),
          fetch("/api/me/factors").then((r) => r.json() as Promise<{ factors?: RiskFactors | null }>),
        ]);

        // 家系：云端有 → 与本地并集合并（谁都不丢）；云端空且本地有 → 迁移上云。
        // 注意副作用（fetch）不放进 setPersons 的 updater——
        // StrictMode 会双调用 updater，副作用必须留在 setState 外面。
        const cloudPersons = Array.isArray(pedRes.persons) ? pedRes.persons : [];
        const local = personsRef.current;
        if (cloudPersons.length > 0) {
          setPersons(mergePersons(local, cloudPersons));
        } else if (local.length > 0) {
          // 新数组身份触发自动备份把本地数据迁上云
          setPersons([...local]);
        }

        // 体检数字：云端有 → 覆盖本地（服务器视为较新）；云端空且本地有 → 迁移上云
        const cloudFactors = facRes.factors ?? null;
        if (cloudFactors) {
          try {
            const localRaw = localStorage.getItem(FACTORS_KEY);
            const same = localRaw && JSON.stringify(JSON.parse(localRaw)) === JSON.stringify(cloudFactors);
            if (!same) {
              localStorage.setItem(FACTORS_KEY, JSON.stringify(cloudFactors));
              setFactorsEpoch((n) => n + 1); // 表单重挂载，从 localStorage 重读
              setFactors(cloudFactors);
            }
          } catch {
            /* 本地读不了就跳过覆盖 */
          }
        } else {
          if (factorsRef.current) {
            const local = factorsRef.current;
            void fetch("/api/me/factors", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ factors: local }),
            }).catch(() => {});
          }
        }
        // 对账完成：此后 persons/factors 的任何变更（含删空）自动备份
        cloudSyncedRef.current = true;
      } catch {
        /* 网络抖动：本地功能不受影响，下次登录再对账 */
      }
    })();
  }

  // 已登录的会话（cookie 还有效）打开页面时也要对账一次
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ user?: AccountUser | null }>)
      .then((d) => {
        if (d.user) {
          setAccount(d.user);
          syncFromCloud();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登录/登出事件（顶栏弹层发出）
  useEffect(() => {
    function onAuth(e: Event) {
      const detail = (e as CustomEvent<AuthEventDetail>).detail;
      if (detail.type === "login") {
        setAccount(detail.user);
        cloudSyncedRef.current = false; // 新会话：重新对账后才恢复自动备份
        syncFromCloud();
      } else {
        setAccount(null);
        cloudSyncedRef.current = false;
      }
    }
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登录期间：家系每次变更自动备份（低频写，800ms 防抖足够）。
  // 注意不能以 persons.length===0 跳过——删空也是一次合法变更，
  // 不备份的话云端残留会在下次对账时复活已删除的节点。
  useEffect(() => {
    if (!account || !cloudSyncedRef.current) return;
    const t = setTimeout(() => {
      void fetch("/api/me/pedigree", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persons }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [persons, account]);

  // 登录期间：体检数字每次变更自动备份。
  // cloudSyncedRef 门闩同样必要：防止登录对账完成前，
  // 本地较旧的数字抢先覆盖云端较新的数字。
  useEffect(() => {
    if (!account || !factors || !cloudSyncedRef.current) return;
    const t = setTimeout(() => {
      void fetch("/api/me/factors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factors }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [factors, account]);

  function loadDemo() {
    setPersons(DEMO);
    setLastAdded(null);
    setSelected("paternal-grandfather");
  }

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
    <main className="page page-wide page-chat">
      {llmReady === false && (
        <div className="llm-banner">
          <span className="llm-dot is-off" />
          <span className="llm-text">
            AI 抽取当前未连接。模型跑在演示机上（本地推理，家族信息不出机器），
            仅在评审时段开机在线；<strong>其余功能不受影响</strong>。
          </span>
          {persons.length === 0 && (
            <button type="button" className="llm-action" onClick={loadDemo}>
              加载示例家系 →
            </button>
          )}
        </div>
      )}

      {llmReady === true && (
        <div className="llm-banner is-ok">
          <span className="llm-dot" />
          <span className="llm-text">
            AI 抽取已连接 · 本地推理，家族信息不出这台机器
          </span>
        </div>
      )}

      <div className="workspace">
        <aside className="chat-side">
          {/* 功能切换：录入和问答共用左栏，一次只显示一个。
              分类原则——「要一起用的放一起」：
              记录 + 右侧家系图（说了就见图）；问答 + 体检数字（算风险要用）。 */}
          <div className="side-tabs" role="tablist" aria-label="左栏功能">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "record"}
              className={`side-tab${mode === "record" ? " is-active" : ""}`}
              onClick={() => setMode("record")}
            >
              <span className="side-tab-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.5-.7L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
                </svg>
              </span>
              <span className="side-tab-text">
                <span className="side-tab-label">记录家人</span>
                <span className="side-tab-hint">说出来，图上实时长节点</span>
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "qa"}
              className={`side-tab${mode === "qa" ? " is-active" : ""}`}
              onClick={() => setMode("qa")}
            >
              <span className="side-tab-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.4 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1 .9-1 1.6v.2" />
                  <path d="M12 17h.01" />
                </svg>
              </span>
              <span className="side-tab-text">
                <span className="side-tab-label">问点什么</span>
                <span className="side-tab-hint">它自己决定查什么、算什么</span>
              </span>
            </button>
          </div>

          {/* 两个面板都保持挂载（hidden 切换）：切回来时聊天记录/问答历史还在 */}
          <div className="side-mode" hidden={mode !== "record"}>
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
          </div>

          <div className="side-mode" hidden={mode !== "qa"}>
            <AgentPanel
              persons={persons}
              factors={factors}
              onRequestFactors={() => setFactorsOpenSignal((n) => n + 1)}
            />
          </div>

          {/* 体检数字：常驻状态条（两个模式都需要，且徽章防漏填），点开玻璃弹层填写 */}
          <div className="side-foot">
            <RiskFactorsForm
              key={factorsEpoch}
              value={factors}
              onChange={setFactors}
              openSignal={factorsOpenSignal}
            />
          </div>
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
              {ascvdFamilyHistory(persons).length > 0 ? (
                <>
                  <p className="next-step-body">
                    心血管病家族史为「有」（一级亲属心梗或脑卒中）——这项直接进入
                    China-PAR 心血管风险方程。
                  </p>
                  <Link className="next-step-cta" href="/cvd">
                    用国家指南方程算你的心血管风险 →
                  </Link>
                </>
              ) : (
                <>
                  <p className="next-step-body">
                    家系里还没有「一级亲属心梗或脑卒中」的记录，所以这项不进方程；
                    其余变量仍然可以算，也可以在 China-PAR 页补数字。
                  </p>
                  <Link className="next-step-cta" href="/cvd">
                    去 China-PAR 页算心血管风险 →
                  </Link>
                </>
              )}
            </div>
          )}

          {familySignals(persons).length > 0 && (
            <div className="exposure-hints">
              <div className="next-step-label">家系里的信号</div>
              {familySignals(persons).map((sig) => (
                <div
                  key={sig.id}
                  className={`exposure-hint${sig.level === "attention" ? " is-attention" : ""}`}
                >
                  <p className="exposure-hint-title">{sig.title}</p>
                  <p className="exposure-hint-body">{sig.body}</p>
                </div>
              ))}
            </div>
          )}

          {exposureHints(persons, {
            smoker: factors?.smoker ?? false,
            drinker: factors?.drinker ?? false,
            lungDisease: factors?.lungDisease ?? false,
          }).length > 0 && (
            <div className="exposure-hints">
              <div className="next-step-label">家系 × 生活方式</div>
              {exposureHints(persons, {
                smoker: factors?.smoker ?? false,
                drinker: factors?.drinker ?? false,
                lungDisease: factors?.lungDisease ?? false,
              }).map((h) => (
                <div
                  key={h.id}
                  className={`exposure-hint${h.level === "attention" ? " is-attention" : ""}`}
                >
                  <p className="exposure-hint-title">{h.title}</p>
                  <p className="exposure-hint-body">{h.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
