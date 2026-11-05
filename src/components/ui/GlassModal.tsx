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

  // 键盘与焦点：Esc 关闭、Tab 在对话框内回环、关闭后把焦点还给触发元素
  useEffect(() => {
    if (!open) return;

    const prevFocus = document.activeElement as HTMLElement | null;

    function focusables(): HTMLElement[] {
      const root = dialogRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // 打开中的下拉自己会用 Esc 收起；这里再关一次弹层，
        // 用户就会「想收起下拉却把整个弹层关掉」（实测过）。
        const el = e.target as HTMLElement | null;
        if (el?.closest?.(".gselect.is-open")) return;
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // 焦点陷阱：不让 Tab 跑到背后被锁住的页面上
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first?.focus();
      } else if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last?.focus();
      }
    }

    document.addEventListener("keydown", onKey);

    const raf = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      // 关闭后把焦点还给触发按钮，键盘用户不用重新 Tab 一路找
      prevFocus?.focus?.();
    };
  }, [open]);

  // 滚动锁跟随「在场」而不是「open」：open 一翻 false 就开始播 240ms 退场动画，
  // 若这时就解锁，滚轮会滚到背后内容上。
  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

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
