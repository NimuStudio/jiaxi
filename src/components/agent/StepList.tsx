"use client";

import type { AgentStep } from "@/lib/agent/loop";

/**
 * 执行轨迹。
 *
 * 这是整个 Agent 功能最该被看见的部分：评委要判断「它是不是真的在做规划」，
 * 靠的不是最终那句回答，而是这里——它先查了什么、为什么、拿到什么、然后改了什么主意。
 */

const ACTION_LABEL: Record<string, string> = {
  summarize_pedigree: "汇总家系",
  compute_risk: "计算风险",
  search_knowledge: "检索依据",
  final_answer: "生成回答",
};

const ACTION_HINT: Record<string, string> = {
  summarize_pedigree: "读已录入的亲属，统计几级、几人、几岁发病",
  compute_risk: "用 FINDRISC 算 10 年风险与可回收分数",
  search_knowledge: "在已核实知识库里检索，查不到就说查不到",
  final_answer: "把前面的结果组织成一句话",
};

export function StepList({ steps }: { steps: AgentStep[] }) {
  return (
    <ol className="trace">
      {steps.map((s, i) => (
        <li key={i} className="trace-item">
          <span className="trace-index">{i + 1}</span>
          <div className="trace-body">
            <div className="trace-head">
              <span className="trace-action">{ACTION_LABEL[s.action] ?? s.action}</span>
              <span className="trace-hint">{ACTION_HINT[s.action] ?? ""}</span>
            </div>
            {s.thought && <p className="trace-thought">「{s.thought}」</p>}
            {s.input && <p className="trace-input">参数：{s.input}</p>}
            {s.observation && (
              <pre className="trace-obs">{s.observation}</pre>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
