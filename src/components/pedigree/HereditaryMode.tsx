"use client";

import { useEffect, useState } from "react";
import type { ExtractedPerson } from "@/lib/extract/client";
// 只从 mode.ts 取：从 hereditary.ts 取会把疾病词表打进客户端包
import { MODE_LABEL, type HereditaryDecision } from "@/lib/decision/mode";

/**
 * 遗传模式提示（typed decision model）
 *
 * 只在**真的拿到模型结论**时才显示：source=rules（没配决策模型）或
 * mode=insufficient（模型自己也没把握）都不显示。
 * 理由：这一行是判断，不是事实；判不了就闭嘴，比印一句「证据不足」更诚实。
 * 服务端不可用时静默失败，不影响家系图本身。
 */
export function HereditaryMode({ persons }: { persons: ExtractedPerson[] }) {
  const [decision, setDecision] = useState<HereditaryDecision | null>(null);

  useEffect(() => {
    if (persons.length === 0) {
      setDecision(null);
      return;
    }
    let alive = true;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/decision/hereditary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persons }),
        signal: ctl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: HereditaryDecision | null) => {
          if (alive) setDecision(d);
        })
        .catch(() => {
          // 卸载/换人导致的 abort 是正常路径，不当成失败
          if (alive) setDecision(null);
        });
    }, 600);

    return () => {
      alive = false;
      clearTimeout(timer);
      ctl.abort(); // 在途请求必须掐掉：一次判定要烧 5-7 秒本机推理
    };
  }, [persons]);

  // 接受两类可解释后端：真决策模型 / 本地训练的结构模型。
  // logprob 近似打分（source=scored）不可信（1.7B 会把两代男性发病判成隐性），只作内部信号。
  if (!decision || (decision.source !== "model" && decision.source !== "structural")) return null;

  // 判不了时不装作有结论，而是把缺口摆出来让用户补一句
  // （实测线粒体那例就是缺父系信息被读成显性）
  if (decision.mode === "insufficient") {
    const gaps = decision.gaps.slice(0, 2);
    if (gaps.length === 0) return null;
    return (
      <div className="exposure-hints">
        <div className="next-step-label">遗传模式：还判不了</div>
        <div className="exposure-hint">
          <p className="exposure-hint-title">补充这些信息就能判断</p>
          <p className="exposure-hint-body">{gaps.join("；")}</p>
        </div>
      </div>
    );
  }

  const pct = Math.round(decision.confidence * 100);
  return (
    <div className="exposure-hints">
      <div className="next-step-label">遗传模式</div>
      <div className="exposure-hint">
        <p className="exposure-hint-title">{MODE_LABEL[decision.mode]}</p>
        <p className="exposure-hint-body">
          {decision.source === "model" ? "决策模型" : "本地结构模型"}提示，不是诊断 · 置信度 {pct}%
        </p>
      </div>
    </div>
  );
}
