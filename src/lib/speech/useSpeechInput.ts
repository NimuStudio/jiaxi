"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API 的最小类型声明（浏览器原生，TS 标准库里没有）。
 * 语音输入对应评分细则「多模态能力」里的语音模态：
 * 家里老人的病史往往更适合「说」而不是「打字」，这是场景本身需要的交互。
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechInputResult {
  /** 浏览器是否支持语音识别（Chrome / Edge 支持，Firefox 不支持）。 */
  supported: boolean;
  /** 是否正在录音识别。 */
  listening: boolean;
  /** 中间结果（识别中的半句话），直接显示在输入框里，说完落定。 */
  start: () => void;
  /** 手动停止（把已识别内容落定）。 */
  stop: () => void;
  /** 识别出错时的用户可读提示（权限拒绝、无麦克风、网络等）。 */
  error: string | null;
}

/**
 * 语音输入 hook。
 *
 * onFinal 收到「一句识别完成」的文本，调用方把它追加进输入框——
 * 用户可以连续说几段，说完再点发送。
 */
export function useSpeechInput(onFinal: (text: string) => void): UseSpeechInputResult {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /** 是否是用户主动停止：只有主动停止才不自动重启（静音超时由服务端断开则要重启） */
  const stoppedByUser = useRef(false);
  // onFinal 存进 ref：识别回调触发时用的总是最新闭包
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("当前浏览器不支持语音识别，请用 Chrome / Edge。");
      return;
    }
    setError(null);

    // 先彻底断掉旧实例：否则 onerror / start 抛错 / 静音 end 之后再点开始，
    // 会有两个 recognizer 同时录音（麦克风没关 + 同一句话被追加两遍）。
    try {
      recRef.current?.abort();
    } catch {
      /* 已结束的实例 abort 会抛，忽略 */
    }
    recRef.current = null;
    stoppedByUser.current = false;

    const rec = new Ctor();
    rec.lang = "zh-CN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal && text.trim().length > 0) {
          finalRef.current(text.trim());
        }
      }
    };
    rec.onerror = (e) => {
      const map: Record<string, string> = {
        "not-allowed": "麦克风权限被拒绝了，请在浏览器地址栏允许后重试。",
        "service-not-allowed": "语音服务不可用，请检查网络或换 Chrome / Edge。",
        "no-speech": "没听到声音，再试一次？",
        "audio-capture": "没有检测到麦克风。",
      };
      setError(map[e.error] ?? `语音识别出错（${e.error}）。`);
      setListening(false);
      stoppedByUser.current = true;
      try {
        rec.abort();
      } catch {
        /* 已结束，忽略 */
      }
    };
    rec.onend = () => {
      // 连续模式下服务端会在静音超时后自动断开。用户没主动停就重启，
      // 否则后面说的话会被静默丢弃（老年用户不会盯着按钮看）。
      if (stoppedByUser.current) {
        setListening(false);
        return;
      }
      try {
        rec.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() 在已启动状态下会抛 InvalidStateError——说明正在录，保持 listening
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    stoppedByUser.current = true;
    if (rec) {
      rec.onend = null; // 主动停止时不需要自动重启
      try {
        rec.stop();
      } catch {
        /* 已结束的实例 stop 会抛 InvalidStateError，忽略 */
      }
    }
    setListening(false);
  }, []);

  return { supported, listening, start, stop, error };
}
