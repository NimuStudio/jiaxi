"use client";

import { useRef, useState } from "react";
import type { ExtractedPerson } from "@/lib/extract/client";
import {
  DISEASE_LABEL,
  RELATION_LABEL,
} from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";

interface Message {
  role: "user" | "system";
  text: string;
  tone?: "normal" | "error";
}

export interface ChatPanelProps {
  onExtracted: (persons: ExtractedPerson[]) => void;
  /** 上游是否已有内容，用于「继续补充」的提示。 */
  hasData: boolean;
}

/**
 * 示例句式必须像真人说的话。
 *
 * 踩过的坑：「我爸 52 岁放的支架」——「放的」是「的时候放的」省略了「的时候」，
 * 前面只能接模糊时间（「五十多岁放的支架」），接精确数字就不通。
 * 改成「52 岁那年放了支架」。
 */
const EXAMPLES = [
  "我爸 52 岁那年放了心脏支架，我爷爷有糖尿病。",
  "我老娘是脑溢血走的，走的时候六十来岁。",
  "外婆和姨妈都有乳腺癌，姨妈 48 岁查出来的。",
  "我舅舅 45 岁查出糖尿病，我妈身体还行。",
];

function describe(persons: ExtractedPerson[]): string {
  if (persons.length === 0) {
    return "这段话里没有识别出患病的亲属。";
  }
  const parts = persons.map((p) => {
    const who = RELATION_LABEL[p.relation as RelationType] ?? p.relation;
    const conds = p.conditions
      .map((c) => {
        const name = DISEASE_LABEL[c.code] ?? c.code;
        return c.onsetAge === null ? name : `${name}（${c.onsetAge} 岁）`;
      })
      .join("、");
    return `${who}：${conds || "未记录病名"}`;
  });
  return `记下了 —— ${parts.join("；")}。`;
}

export function ChatPanel({ onExtracted, hasData }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      text: "说说家里人的情况。想到谁说谁，不用有顺序，也不用说得很清楚。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (content.length === 0 || loading) return;

    setMessages((m) => [...m, { role: "user", text: content }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const data = (await res.json()) as {
        persons?: ExtractedPerson[];
        error?: string;
      };

      if (!res.ok || data.error) {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: data.error ?? "抽取服务返回了错误。",
            tone: "error",
          },
        ]);
        return;
      }

      const persons = data.persons ?? [];
      if (persons.length > 0) onExtracted(persons);
      setMessages((m) => [
        ...m,
        { role: "system", text: describe(persons) },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "system",
          text: "连不上抽取服务。请确认 llama-server 已在 127.0.0.1:8080 启动。",
          tone: "error",
        },
      ]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-list" ref={listRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-system"}${
              m.tone === "error" ? " is-error" : ""
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="bubble bubble-system is-thinking">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
            正在读这段话
          </div>
        )}
      </div>

      {!hasData && (
        <div className="chat-examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="example-chip"
              onClick={() => setInput(ex)}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：我爸 55 岁心梗，我妈身体还行"
          disabled={loading}
        />
        <button
          className="chat-send"
          type="submit"
          disabled={loading || input.trim().length === 0}
        >
          记下
        </button>
      </form>
    </div>
  );
}
