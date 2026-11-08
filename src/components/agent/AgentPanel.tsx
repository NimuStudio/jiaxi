"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentResult } from "@/lib/agent/loop";
import type { RiskFact, RiskFactors } from "@/lib/agent/tools";
import { StepList } from "./StepList";
import { useCountUp } from "@/components/ui/useCountUp";
import { MicButton } from "@/components/ui/MicButton";
import { useSpeechInput } from "@/lib/speech/useSpeechInput";
import type { ExtractedPerson } from "@/lib/extract/client";

/**
 * Agent 问答面板。
 *
 * 和上面的「记录」面板分工：记录面板是固定流水线（一句话进、节点出），
 * 这里是模型自己决定调哪些工具、什么时候能回答。
 *
 * 界面上刻意把两样东西分开渲染：
 *   - 措辞（模型的回答，经过数字守卫和引用清洗）；
 *   - 数字（工具返回的结构化事实，直接渲染，不经过模型）。
 * 评委看到的每个数字都来自这条第二条路径。
 */

interface Turn {
  /** 稳定 id：并发/连点时按 id 回填，不再依赖"最后一个 turn" */
  id: number;
  question: string;
  result?: AgentResult;
  error?: string;
}

export interface AgentPanelProps {
  persons: ExtractedPerson[];
  /** 体检数字是否齐了（决定问答能不能算风险）。 */
  factors: RiskFactors | null;
  onRequestFactors: () => void;
}

const SUGGESTIONS = [
  "我的糖尿病风险有多高？",
  "我该注意什么？",
  "为什么要关心家族史？",
];

const BAND_LABEL: Record<string, string> = {
  low: "低",
  "slightly-elevated": "轻度升高",
  moderate: "中等",
  high: "高",
  "very-high": "极高",
};

function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** 风险事实卡：界面直接渲染工具返回的数字，不经过模型。 */
function RiskFactCard({ fact }: { fact: RiskFact }) {
  // 两个数字滚动入场：评委视线会先落在动的那个数字上
  const pct = useCountUp(fact.percent, 700);
  const goal = useCountUp(fact.goalPercent, 700);
  return (
    <div className="fact-card">
      <div className="fact-main">
        <div className="fact-col">
          <span className="fact-value">{fmtPct(pct)}<span className="fact-unit">%</span></span>
          <span className="fact-caption">2 型糖尿病 · 当前 10 年风险 · {BAND_LABEL[fact.band] ?? fact.band}</span>
        </div>
        <span className="fact-arrow">→</span>
        <div className="fact-col">
          <span className="fact-value is-goal">{fmtPct(goal)}<span className="fact-unit">%</span></span>
          <span className="fact-caption">可改变项全部达标后</span>
        </div>
        <div className="fact-badge">
          可回收 {fact.reclaimablePoints} 分
        </div>
      </div>
      {fact.items.length > 0 && (
        <div className="fact-items">
          {fact.items.map((x) => (
            <span key={x.label} className="fact-chip">
              {x.label} {x.points} 分
            </span>
          ))}
        </div>
      )}
      {/* 卡片没有病名时，问肺癌/心血管的人会把这个数当成自己问的那种病 */}
      <p className="fact-note">
        这是 2 型糖尿病的风险（FINDRISC 总分 {fact.score} 分），不是肺癌或心血管风险 ·
        数字由工具计算，不经模型复述
      </p>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const [showTrace, setShowTrace] = useState(false);
  const r = turn.result;

  return (
    <div className="qa-turn">
      <p className="qa-question">{turn.question}</p>

      {turn.error && <p className="qa-error">{turn.error}</p>}

      {r && (
        <>
          <p className="qa-answer">{r.answer}</p>

          {r.facts.risk && <RiskFactCard fact={r.facts.risk} />}

          {r.facts.pedigree.length > 0 && (
            <ul className="qa-pedigree">
              {r.facts.pedigree.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          {r.facts.citations.length > 0 && (
            <div className="qa-citations">
              <span className="qa-cite-label">依据</span>
              {r.facts.citations.map((c) => (
                <span key={c} className="qa-cite">《{c}》</span>
              ))}
            </div>
          )}

          <button
            type="button"
            className="qa-trace-toggle"
            onClick={() => setShowTrace((v) => !v)}
          >
            {showTrace ? "收起推理过程" : `它是怎么想的（${r.steps.length} 步）`}
          </button>
          {showTrace && <StepList steps={r.steps} />}
        </>
      )}
    </div>
  );
}

export function AgentPanel({ persons, factors, onRequestFactors }: AgentPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // 语音提问：和「记录家人」同一个麦克风交互
  const speech = useSpeechInput((text) =>
    setInput((cur) => (cur.trim().length > 0 ? `${cur}${text}` : text)),
  );

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [turns, loading]);

  // 同步的在途锁：loading 是异步 state，同一帧内连点两次都会看到 false，
  // 于是发出两个请求，而回填用的是「最后一个 turn」，第一条提问永远空白。
  const inFlight = useRef(false);
  // 每条提问一个稳定 id，回填时按 id 定位，不再依赖"最后一个"
  const nextId = useRef(1);

  async function ask(text: string) {
    const question = text.trim();
    if (question.length === 0 || inFlight.current) return;

    const id = nextId.current++;
    inFlight.current = true;
    setTurns((t) => [...t, { id, question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, persons, factors }),
        // 本地推理偶尔会挂住：没有超时的话输入框会永久禁用
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await res.json()) as AgentResult & { error?: string };
      setTurns((t) =>
        t.map((turn) =>
          turn.id === id
            ? res.ok && !data.error
              ? { ...turn, result: data }
              : { ...turn, error: data.error ?? `服务返回 ${res.status}` }
            : turn,
        ),
      );
    } catch (e) {
      const aborted = (e as Error)?.name === "TimeoutError" || (e as Error)?.name === "AbortError";
      setTurns((t) =>
        t.map((turn) =>
          turn.id === id
            ? { ...turn, error: aborted ? "问答超时了，请稍后重试。" : "连不上问答服务。" }
            : turn,
        ),
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="agent-panel">
      {/* 标题由左栏顶部的功能切换标签承担（「问点什么」），这里不再重复 */}

      <div className="qa-list" ref={listRef}>
        {turns.length === 0 && (
          <p className="qa-empty">
            家系记好之后就可以问了。问风险、问该注意什么、问依据都行。
          </p>
        )}
        {turns.map((t, i) => (
          <TurnView key={i} turn={t} />
        ))}
        {loading && (
          <div className="bubble bubble-system is-thinking">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            正在查家系、算风险
          </div>
        )}
      </div>

      {turns.length === 0 && (
        <div className="chat-examples">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              className="example-chip"
              onClick={() => void ask(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {!factors && (
        <button type="button" className="qa-factors-hint" onClick={onRequestFactors}>
          还没填体检数字，算不了风险——点这里填
        </button>
      )}

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <input
          className="chat-input"
          aria-label="向家系助手提问"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={speech.listening ? "正在听你说……" : "例如：我的糖尿病风险有多高？"}
          disabled={loading}
          maxLength={200}
        />
        <MicButton speech={speech} />
        <button
          className="chat-send"
          type="submit"
          disabled={loading || input.trim().length === 0}
        >
          问
        </button>
      </form>
      {speech.error && <p className="mic-error">{speech.error}</p>}
    </div>
  );
}
