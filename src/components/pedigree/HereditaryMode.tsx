"use client";

import { useEffect, useState } from "react";
import type { ExtractedPerson } from "@/lib/extract/client";
import { MODE_LABEL, type HereditaryDecision } from "@/lib/decision/hereditary";

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
    const timer = setTimeout(() => {
      fetch("/api/decision/hereditary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persons }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: HereditaryDecision | null) => {
          if (alive) setDecision(d);
        })
        .catch(() => {
          if (alive) setDecision(null);
        });
    }, 600);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [persons]);

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
