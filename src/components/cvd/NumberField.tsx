"use client";

import { useEffect, useState } from "react";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** 越界提示：有值就标红并显示在字段下方 */
  error?: string | null;
  /** 只读展示（例如"现在还在吸"时戒烟年数恒为 0） */
  disabled?: boolean;
  onChange: (v: number) => void;
}

/**
 * 数字输入框。
 *
 * 受控的 number input 如果直接绑数值，会掉进两个坑：
 *  - 删空时 Number("") || 0 立刻回写成 0，删不掉；
 *  - 打小数点那一帧 Number("6.") === 6，小数点被吃掉，继续输入变成 65。
 * 所以内部用字符串草稿：输入过程中原样保留，只把「可解析的值」向上报告；
 * 失焦后再按真实值归位。
 */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  error,
  disabled = false,
  onChange,
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  return (
    <label className="factors-field">
      <span className="factors-label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(String(value));
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text);
          if (text.trim() !== "" && Number.isFinite(n)) onChange(n);
        }}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={error ? "is-invalid" : undefined}
      />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}
