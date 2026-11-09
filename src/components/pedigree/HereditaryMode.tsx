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

  // 只认真决策模型：实测 1.7B 分诊 LoRA 会把「两代男性发病」判成隐性，
  // logprob 近似打分（source=scored）只能当内部信号，不能显示成结论。
  if (!decision || decision.source !== "model" || decision.mode === "insufficient") {
    return null;
  }

  const pct = Math.round(decision.confidence * 100);
  return (
    <div className="exposure-hints">
      <div className="next-step-label">遗传模式</div>
      <div className="exposure-hint">
        <p className="exposure-hint-title">{MODE_LABEL[decision.mode]}</p>
        <p className="exposure-hint-body">
          决策模型置信度 {pct}% · {decision.reason}
        </p>
      </div>
    </div>
  );
}
