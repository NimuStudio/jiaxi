"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * 通用玻璃二级面板（弹层）。
 *
 * 与自绘 GlassSelect 的玻璃下拉同一套质感语言：四圆角玻璃卡 +
 * 半透明模糊背景。入场/退场都有动画：
 *  - 打开：背景淡入 + 卡片从下方浮起（弹簧）；
 *  - 关闭：先播放 220ms 的淡出下坠，动画结束后才真正卸载
 *    （直接 return null 卸载会「闪没」，观感等于没有动画）；
 *  - 正文里的表单字段/清单行有逐个浮现的错峰动画。
 *
 * 交互约定：
 *  - Esc / 点背景 → 关闭；
 *  - 打开期间锁住页面滚动，避免背后内容跟着滚；
 *  - 对话框高度上限 78vh，正文区内部滚动。
 */
const EXIT_MS = 240;

export interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  children: ReactNode;
  /** 底部操作区（确定/取消按钮等）。 */
  footer?: ReactNode;
}

export function GlassModal({
  open,
  onClose,
  title,
  kicker,
  children,
  footer,
}: GlassModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  /** 动画态：visible = 挂载中（含退场动画期间）；closing = 正在播退场。 */
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // open 的变化驱动进出场：
  //  - true  → 立即挂载并播入场动画；
  //  - false → 若还在场，先转 closing 播退场，EXIT_MS 后才卸载。
  // 定时器用 ref 持有而不是 effect 返回值清理：setClosing 会让 effect
  // 重跑，上一轮 cleanup 会把定时器清掉，弹层就永远停在「半关」不卸载。
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (exitTimer.current) {
        clearTimeout(exitTimer.current);
        exitTimer.current = null;
      }
      setClosing(false);
      setVisible(true);
      return;
    }
    // 已在退场流程（定时器已挂）或根本不在场：跳过
    if (!visible || closing) return;
    setClosing(true);
    exitTimer.current = setTimeout(() => setVisible(false), EXIT_MS);
  }, [open, visible, closing]);

  // 组件卸载时兜底清理定时器
  useEffect(() => {
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, []);

  // onClose 用 ref 持有：调用方几乎都传内联箭头函数，每次渲染都是新引用。
  // 若把它放进下面 effect 的依赖，用户每敲一个字符都会重跑一次 effect，
  // 其中的 focus() 会把焦点从输入框抢回对话框 —— 弹层里根本没法连续输入。
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 打开后把焦点移进对话框，键盘用户不用再 Tab 一路找
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className={`gmodal-backdrop${closing ? " is-closing" : ""}`}
      onMouseDown={onClose}
    >
      <div
        className={`gmodal${closing ? " is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gmodal-head">
          <div>
            {kicker && <p className="gmodal-kicker">{kicker}</p>}
            <h2 className="gmodal-title">{title}</h2>
          </div>
          <button type="button" className="gmodal-close" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="gmodal-body">{children}</div>
        {footer && <div className="gmodal-foot">{footer}</div>}
      </div>
    </div>
  );
}
