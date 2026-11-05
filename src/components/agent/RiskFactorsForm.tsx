"use client";

import { useEffect, useRef, useState } from "react";
import type { RiskFactors } from "@/lib/agent/tools";
import { GlassModal } from "@/components/ui/GlassModal";
import { FACTOR_BOUNDS } from "@/lib/risk/factors-validate";

/** 与服务端共用的值域判断（数字字段） */
const inRange = (v: number, [min, max]: readonly [number, number]) =>
  Number.isFinite(v) && v >= min && v <= max;

/**
 * 体检数字表单（Agent 问答用）。
 *
 * 形态：常驻一行入口 + 玻璃二级弹层。
 * - 入口行上常驻徽章（「还差 N 项」/「已填」）——弹层化之后
 *   依然能看见「没填齐」这件事，不会漏填；
 * - 点入口或问答面板里的「补几个数」打开弹层，填完点「确定」关闭；
 * - 数据实时保存（localStorage + onChange），关掉弹层也不丢。
 * - 性别用自绘玻璃下拉，不用原生 select（原生弹层无法做玻璃质感，
 *   且占位项会被当成一个「选项」混进列表里）。
 */

const STORAGE_KEY = "pedigree-risk-factors";

type Draft = {
  age: string;
  sex: "male" | "female" | "";
  bmi: string;
  waistCm: string;
  physicallyActive: boolean;
  eatsVegetablesDaily: boolean;
  onAntihypertensive: boolean;
  historyOfHighGlucose: boolean;
  smoker: boolean;
  drinker: boolean;
  lungDisease: boolean;
};

const EMPTY: Draft = {
  age: "",
  sex: "",
  bmi: "",
  waistCm: "",
  physicallyActive: false,
  eatsVegetablesDaily: false,
  onAntihypertensive: false,
  historyOfHighGlucose: false,
  smoker: false,
  drinker: false,
  lungDisease: false,
};

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const d = JSON.parse(raw) as Partial<Draft>;
    return { ...EMPTY, ...d };
  } catch {
    return EMPTY;
  }
}

function toFactors(d: Draft): RiskFactors | null {
  const age = Number(d.age);
  const bmi = Number(d.bmi);
  const waistCm = Number(d.waistCm);
  // 与 /api/me/factors、/api/agent 共用同一份值域，避免本地说"可用"、服务端却拒收
  if (!inRange(age, FACTOR_BOUNDS.age)) return null;
  if (!inRange(bmi, FACTOR_BOUNDS.bmi)) return null;
  if (!inRange(waistCm, FACTOR_BOUNDS.waistCm)) return null;
  if (d.sex !== "male" && d.sex !== "female") return null;
  return {
    age: Math.round(age),
    sex: d.sex,
    bmi: Math.round(bmi * 10) / 10,
    waistCm: Math.round(waistCm),
    physicallyActive: d.physicallyActive,
    eatsVegetablesDaily: d.eatsVegetablesDaily,
    onAntihypertensive: d.onAntihypertensive,
    historyOfHighGlucose: d.historyOfHighGlucose,
    smoker: d.smoker,
    drinker: d.drinker,
    lungDisease: d.lungDisease,
  };
}

export interface RiskFactorsFormProps {
  value: RiskFactors | null;
  onChange: (f: RiskFactors | null) => void;
  /** 外部要求打开弹层（问答面板里点了「补几个数」）。 */
  openSignal: number;
}

/** 生活方式暴露：与 FINDRISC 计分项分开列，避免让人以为它们会改分数 */
const EXPOSURE_CHECKS: Array<{ key: keyof Draft; label: string; hint: string }> = [
  { key: "smoker", label: "现在吸烟", hint: "已计入 China-PAR 方程" },
  { key: "drinker", label: "经常饮酒", hint: "两个方程都不含此项，仅作记录" },
  { key: "lungDisease", label: "有慢支 / 肺气肿 / 慢阻肺史", hint: "会给相对风险提示，不改分数" },
];

const CHECKS: Array<{ key: keyof Draft; label: string; hint: string }> = [
  { key: "physicallyActive", label: "每天有体力活动", hint: "每天至少 30 分钟" },
  { key: "eatsVegetablesDaily", label: "每天吃蔬菜水果", hint: "不是每天就不勾" },
  { key: "onAntihypertensive", label: "在服降压药", hint: "规律服用即算" },
  { key: "historyOfHighGlucose", label: "有过高血糖", hint: "体检/孕期都算" },
];

/** 自绘玻璃下拉：占位文案只出现在收起态，弹层里只有真实选项。 */
function GlassSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`gselect${open ? " is-open" : ""}`} ref={ref}>
      <button
        type="button"
        className={`gselect-btn${current ? "" : " is-placeholder"}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current ? current.label : placeholder}</span>
        <span className="gselect-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="gselect-pop" role="listbox">
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`gselect-opt${o.value === value ? " is-active" : ""}`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RiskFactorsForm({ value, onChange, openSignal }: RiskFactorsFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    setDraft(d);
    const f = toFactors(d);
    onChange(f);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  function update(patch: Partial<Draft>) {
    if (!loaded) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 存不进去也不影响本页使用 */
    }
    onChange(toFactors(next));
  }

  const missing = [
    inRange(Number(draft.age), FACTOR_BOUNDS.age) ? null : "年龄",
    draft.sex === "" ? "性别" : null,
    inRange(Number(draft.bmi), FACTOR_BOUNDS.bmi) ? null : "BMI",
    inRange(Number(draft.waistCm), FACTOR_BOUNDS.waistCm) ? null : "腰围",
  ].filter(Boolean) as string[];

  return (
    <>
      <div className="factors-form">
        <button
          type="button"
          className="factors-head"
          onClick={() => setOpen(true)}
        >
          <span className="factors-head-title">
            体检数字
            {value ? (
              <span className="factors-badge is-ok">已填 · 问答可用</span>
            ) : (
              <span className="factors-badge is-missing">还差 {missing.length} 项</span>
            )}
          </span>
          <span className="factors-caret">填写</span>
        </button>

        {/* 已填齐时的摘要：不打开弹层也能一眼看到自己存了什么 */}
        {value && (
          <p className="factors-summary">
            {value.age} 岁 · {value.sex === "male" ? "男" : "女"} · BMI{" "}
            {value.bmi} · 腰围 {value.waistCm} cm
          </p>
        )}
      </div>

      <GlassModal
        open={open}
        onClose={() => setOpen(false)}
        kicker="存在这台机器上 · 不传第三方"
        title="体检数字"
        footer={
          <button
            type="button"
            className="gmodal-confirm"
            disabled={missing.length > 0}
            title={
              missing.length > 0 ? `还差 ${missing.join("、")}` : "保存并关闭"
            }
            onClick={() => setOpen(false)}
          >
            {missing.length > 0 ? `还差 ${missing.join("、")}` : "确定"}
          </button>
        }
      >
        <div className="factors-body">
          <div className="factors-grid">
            <label className="factors-field">
              <span className="factors-label">年龄</span>
              <input
                type="number"
                min={1}
                max={110}
                value={draft.age}
                onChange={(e) => update({ age: e.target.value })}
                placeholder="48"
              />
            </label>
            <div className="factors-field">
              <span className="factors-label">性别</span>
              <GlassSelect
                value={draft.sex}
                onChange={(v) => update({ sex: v as Draft["sex"] })}
                placeholder="选择性别"
                options={[
                  { value: "male", label: "男" },
                  { value: "female", label: "女" },
                ]}
              />
            </div>
            <label className="factors-field">
              <span className="factors-label">BMI</span>
              <input
                type="number"
                min={10}
                max={60}
                step={0.1}
                value={draft.bmi}
                onChange={(e) => update({ bmi: e.target.value })}
                placeholder="27"
              />
            </label>
            <label className="factors-field">
              <span className="factors-label">腰围 cm</span>
              <input
                type="number"
                min={40}
                max={200}
                value={draft.waistCm}
                onChange={(e) => update({ waistCm: e.target.value })}
                placeholder="96"
              />
            </label>
          </div>

          <div className="factors-checks">
            {CHECKS.map((c) => (
              <label key={c.key} className="factors-check">
                <input
                  type="checkbox"
                  checked={Boolean(draft[c.key])}
                  onChange={(e) => update({ [c.key]: e.target.checked } as Partial<Draft>)}
                />
                <span className="factors-check-text">
                  <span className="factors-check-label">{c.label}</span>
                  <span className="factors-check-hint">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="factors-group-title">生活方式暴露</p>
          <div className="factors-checks">
            {EXPOSURE_CHECKS.map((c) => (
              <label key={c.key} className="factors-check">
                <input
                  type="checkbox"
                  checked={Boolean(draft[c.key])}
                  onChange={(e) => update({ [c.key]: e.target.checked } as Partial<Draft>)}
                />
                <span className="factors-check-text">
                  <span className="factors-check-label">{c.label}</span>
                  <span className="factors-check-hint">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="factors-note">
            用于本地计算风险；登录后会备份到本机数据库（同一台机器），不传第三方。
            {missing.length > 0 && ` 填齐 ${missing.join("、")} 就能算了。`}
          </p>
        </div>
      </GlassModal>
    </>
  );
}
