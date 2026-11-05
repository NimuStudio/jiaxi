"use client";

import type { UseSpeechInputResult } from "@/lib/speech/useSpeechInput";

/**
 * 语音输入按钮（麦克风）。
 *
 * 挂在输入框旁：空闲时灰色话筒，识别中红色脉动；
 * 不支持的浏览器不渲染（而不是渲染一个点了报错的按钮）。
 * 点击切换开始/停止；识别出错的提示文字显示在输入框下方。
 */
export function MicButton({ speech }: { speech: UseSpeechInputResult }) {
  if (!speech.supported) return null;

  return (
    <button
      type="button"
      className={`mic-btn${speech.listening ? " is-listening" : ""}`}
      onClick={() => (speech.listening ? speech.stop() : speech.start())}
      title={speech.listening ? "停止识别" : "按一下开始说话"}
      aria-label={speech.listening ? "停止语音识别" : "开始语音识别"}
      aria-pressed={speech.listening}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path
          d="M5 11a7 7 0 0 0 14 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M12 18v3M9 21h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
