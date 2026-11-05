"use client";

import { useRef, useState } from "react";
import type { ExtractedPerson } from "@/lib/extract/client";
import {
  DISEASE_LABEL,
  RELATION_LABEL,
} from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";
import { useSpeechInput } from "@/lib/speech/useSpeechInput";
import { MicButton } from "@/components/ui/MicButton";
import { DiseaseCheatSheet } from "@/components/chat/DiseaseCheatSheet";

interface Message {
  role: "user" | "system";
  text: string;
  tone?: "normal" | "error";
}

/** 流式抽取的可观察阶段（与后端 ExtractStage 事件对应）。 */
interface StageState {
  splitTotal: number;
  currentIndex: number;
  currentSegment: string;
}

export interface ChatPanelProps {
  /** source 是产生这批结果的用户原话，用于家系图上的「依据」回溯。 */
  onExtracted: (persons: ExtractedPerson[], source: string) => void;
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
  const [stage, setStage] = useState<StageState | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 语音输入：老人念叨病史更愿意说而不是打字，说完落在输入框里再确认
  const speech = useSpeechInput((text) =>
    setInput((cur) => (cur.trim().length > 0 ? `${cur}${text}` : text)),
  );

  /**
   * 读取 SSE 流：按空行切事件，逐条解析 JSON。
   * 用 fetch 而不是 EventSource，因为要 POST 请求体。
   */
  async function send(text: string) {
    const content = text.trim();
    if (content.length === 0 || loading) return;

    setMessages((m) => [...m, { role: "user", text: content }]);
    setInput("");
    setLoading(true);
    setStage(null);

    try {
      const res = await fetch("/api/extract/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });

      if (!res.ok) {
        // 503 时 body 是普通 JSON（服务不在线），不走了流式协议
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: data?.error ?? `抽取服务返回 ${res.status}。`,
            tone: "error",
          },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("浏览器不支持流式读取");

      const decoder = new TextDecoder();
      let buffer = "";
      let persons: ExtractedPerson[] | null = null;
      let errorMsg: string | null = null;

      // 流式解析 SSE
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(line.slice(5)) as {
              type: string;
              persons?: ExtractedPerson[];
              error?: string;
              total?: number;
              index?: number;
              segment?: string;
            };
            if (payload.type === "split") {
              setStage({
                splitTotal: payload.total ?? 0,
                currentIndex: 0,
                currentSegment: "",
              });
            } else if (payload.type === "segment") {
              setStage((s) => ({
                splitTotal: s?.splitTotal ?? 0,
                currentIndex: payload.index ?? 0,
                currentSegment: payload.segment ?? "",
              }));
            } else if (payload.type === "done") {
              persons = payload.persons ?? [];
            } else if (payload.type === "error") {
              errorMsg = payload.error ?? "抽取失败。";
            }
          } catch {
            /* 半条事件被 TCP 切开了，留在 buffer 等下一段 */
          }
        }
      }

      if (errorMsg) {
        setMessages((m) => [
          ...m,
          { role: "system", text: errorMsg, tone: "error" },
        ]);
        return;
      }

      // 没收到 done 事件（流被中途切断）时，不能把「没结果」说成「没有患病亲属」——
      // 那是把失败当事实，恰好违背这个项目最在意的一条。
      if (persons === null) {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            text: "抽取没有返回结果（连接可能中断了），请再试一次。",
            tone: "error",
          },
        ]);
        return;
      }

      const result = persons;
      if (result.length > 0) onExtracted(result, content);
      setMessages((m) => [
        ...m,
        { role: "system", text: describe(result) },
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
      setStage(null);
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
          <div className="bubble bubble-system is-thinking extract-stage">
            {stage ? (
              <>
                <div className="stage-progress">
                  <span className="stage-kicker">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                    {stage.splitTotal > 1
                      ? `逐句抽取 ${stage.currentIndex}/${stage.splitTotal}`
                      : stage.splitTotal === 1
                        ? "正在抽取"
                        : "正在分句"}
                  </span>
                  <p className="stage-segment">「{stage.currentSegment}」</p>
                </div>
              </>
            ) : (
              <>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
                正在读这段话
              </>
            )}
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

      {/* 疾病清单入口：让用户知道哪些说法能被听懂，减少词表外的漏网表述 */}
      <div className="cheat-entry">
        <DiseaseCheatSheet />
      </div>

      <form
        className="chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={speech.listening ? "正在听你说……" : "例如：我爸前年放了支架，那时候五十五"}
          disabled={loading}
        />
        <MicButton speech={speech} />
        <button
          className="chat-send"
          type="submit"
          disabled={loading || input.trim().length === 0}
        >
          记下
        </button>
      </form>
      {speech.error && <p className="mic-error">{speech.error}</p>}
    </div>
  );
}
