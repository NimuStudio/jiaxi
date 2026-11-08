"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluatePlco,
  PLCO_RANGE,
  type PlcoEducation,
  type PlcoInput,
  type PlcoRace,
} from "@/lib/risk/plcom2012";
import type { ExtractedPerson } from "@/lib/extract/client";
import { NumberField } from "@/components/cvd/NumberField";
import { RELATION_LABEL } from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";
import { readLungFamilyHistory } from "@/lib/risk/lungFamily";
import { useCountUp } from "@/components/ui/useCountUp";

/**
 * 肺癌风险页（PLCOm2012）。
 *
 * 老师在评审里提的场景是「家族里肺功能不好 + 本人吸烟 → 肺癌风险」。
 * 这里用一个**系数完整公开**的模型来回答：年龄、种族、教育、BMI、COPD、
 * 既往肿瘤史、家族史、吸烟状态/强度/年限/戒烟年数 → 6 年肺癌风险。
 *
 * 边界写死在界面上：
 * - 只对「曾经吸烟者」建模（原文的建模人群）；
 * - 年龄 55–74 之外原文明说表现不确定；
 * - 数字是人群模型的估计，不是个人结局。
 */

const RACE_OPTIONS: Array<{ value: PlcoRace; label: string }> = [
  { value: "white", label: "白人" },
  { value: "black", label: "黑人" },
  { value: "hispanic", label: "西班牙裔" },
  { value: "asian", label: "亚裔" },
  { value: "aian", label: "美洲印第安/阿拉斯加原住民" },
  { value: "nhpi", label: "夏威夷/太平洋岛民" },
];

const EDUCATION_OPTIONS: Array<{ value: PlcoEducation; label: string }> = [
  { value: 1, label: "初中及以下" },
  { value: 2, label: "高中" },
  { value: 3, label: "高中后培训" },
  { value: 4, label: "大学在读" },
  { value: 5, label: "大学毕业" },
  { value: 6, label: "研究生及以上" },
];

const DEFAULTS: PlcoInput = {
  age: 62,
  race: "white",
  education: 3,
  bmi: 24,
  copd: false,
  priorCancer: false,
  familyLungCancer: false,
  smokingStatus: "current",
  cigarettesPerDay: 20,
  smokingYears: 30,
  quitYears: 0,
};

/** 与原文一致的常用筛查阈值：UKLS 用 6 年 ≥1.51%，NLST 等价阈值 1.3455% */
const THRESHOLD_UKLS = 0.0151;
const THRESHOLD_NLST = 0.013455;

export default function LungRiskPage() {
  const [form, setForm] = useState<PlcoInput>(DEFAULTS);
  const [familyNote, setFamilyNote] = useState<string | null>(null);

  // 从家系里读「一级亲属肺癌」：有就自动勾上，并说明是谁
  useEffect(() => {
    let persons: ExtractedPerson[] = [];
    try {
      const demo =
        new URLSearchParams(window.location.search).get("demo") === "1" ||
        sessionStorage.getItem("pedigree-demo") === "1";
      const raw =
        (demo ? sessionStorage.getItem("pedigree-persons-demo") : null) ??
        localStorage.getItem("pedigree-persons");
      if (raw) persons = JSON.parse(raw) as ExtractedPerson[];
    } catch {
      persons = [];
    }
    const { firstDegree, secondDegree } = readLungFamilyHistory(persons);
    if (firstDegree) {
      setForm((f) => ({ ...f, familyLungCancer: true }));
      const who = RELATION_LABEL[firstDegree.relation as RelationType] ?? "一位一级亲属";
      setFamilyNote(`从你的家系图读出：${who}有肺癌史，已自动勾选`);
      return;
    }
    // 模型只认一级亲属：二级亲属有肺癌时说明「为什么没勾」，避免用户以为漏读了
    if (secondDegree) {
      const who = RELATION_LABEL[secondDegree.relation as RelationType] ?? "一位二级亲属";
      setFamilyNote(
        `你的家系图里${who}有肺癌史；PLCOm2012 的家族史项只统计一级亲属（父母、兄弟姊妹、子女），所以这里没有自动勾选。`,
      );
    }
  }, []);

  const result = useMemo(() => evaluatePlco(form), [form]);
  const anim = useCountUp(result.risk, 600);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (form.age < PLCO_RANGE.minAge || form.age > PLCO_RANGE.maxAge)
      out.age = `应在 ${PLCO_RANGE.minAge}–${PLCO_RANGE.maxAge} 之间`;
    if (form.bmi < 10 || form.bmi > 60) out.bmi = "应在 10–60 之间";
    if (form.cigarettesPerDay < 1 || form.cigarettesPerDay > 80)
      out.cigarettesPerDay = "应在 1–80 之间";
    if (form.smokingYears < 0 || form.smokingYears > 70) out.smokingYears = "应在 0–70 之间";
    if (form.quitYears < 0 || form.quitYears > 60) out.quitYears = "应在 0–60 之间";
    return out;
  }, [form]);

  const invalid = Object.keys(errors).length > 0;
  const pct = (v: number) => (v * 100).toFixed(1);
  const reachedUkls = result.risk >= THRESHOLD_UKLS;
  const reachedNlst = result.risk >= THRESHOLD_NLST;
  const outsideValidatedAge =
    form.age < PLCO_RANGE.validatedAge[0] || form.age > PLCO_RANGE.validatedAge[1];

  const update = (patch: Partial<PlcoInput>) => setForm((f) => ({ ...f, ...patch }));

  /** 贡献最大的三项（对数优势），用于解释"为什么是这个数" */
  const topTerms = useMemo(() => {
    const labels: Record<string, string> = {
      age: "年龄",
      intensity: "吸烟强度",
      duration: "吸烟年限",
      family: "家族史",
      currentSmoker: "仍在吸烟",
      copd: "COPD",
      priorCancer: "既往肿瘤史",
      quitTime: "戒烟年数",
      bmi: "BMI",
      education: "教育",
      race: "种族",
    };
    return Object.entries(result.terms)
      .filter(([k]) => k !== "constant")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => ({ label: labels[k] ?? k, value: v }));
  }, [result.terms]);

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">把吸烟史放进肺癌筛查模型</h1>
        <p className="page-sub">
          PLCOm2012 模型——老师提到的「家里肺功能不好 + 本人吸烟」在这里变成可计算的 6
          年风险，而不是一句笼统的"高风险"。
        </p>
      </div>

      <section className="card">
        <p className="section-label">未来 6 年肺癌风险 · PLCOm2012</p>

        {invalid ? (
          <div className="risk-headline">
            <span className="risk-big">—</span>
            <span className="risk-caption">有几项超出合理范围：{Object.keys(errors).length} 项</span>
          </div>
        ) : (
          <div className="risk-headline">
            <span className={`risk-big ${reachedUkls ? "is-high" : "is-low"}`}>
              {pct(anim)}
              <span className="risk-unit">%</span>
            </span>
            <span className={`band-chip ${reachedUkls ? "is-high" : "is-low"}`}>
              {reachedUkls ? "达到筛查阈值" : "未达筛查阈值"}
            </span>
            <span className="risk-caption">
              常用阈值：6 年 ≥1.51%（UKLS）· ≥1.35%（NLST 等价）
            </span>
          </div>
        )}

        {familyNote && <p className="cvd-fh-hint">{familyNote}</p>}

        {outsideValidatedAge && (
          <p className="cvd-delta">
            年龄 {form.age} 岁超出原文验证人群（55–74 岁），这个数字只能当参考。
          </p>
        )}

        {!invalid && (
          <p className="cvd-delta">
            影响最大的三项：
            {topTerms
              .map((t) => `${t.label} ${t.value >= 0 ? "+" : "−"}${Math.abs(t.value).toFixed(2)}`)
              .join(" · ")}
            （相对模型中心值的对数优势贡献）
          </p>
        )}

        <div className="factors-grid" style={{ marginTop: 18 }}>
          <NumberField
            label="年龄 岁"
            value={form.age}
            min={PLCO_RANGE.minAge}
            max={PLCO_RANGE.maxAge}
            error={errors.age}
            onChange={(age) => update({ age })}
          />
          <label className="factors-field">
            <span className="factors-label">种族 / 族裔</span>
            <select value={form.race} onChange={(e) => update({ race: e.target.value as PlcoRace })}>
              {RACE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="factors-field">
            <span className="factors-label">教育程度</span>
            <select
              value={form.education}
              onChange={(e) => update({ education: Number(e.target.value) as PlcoEducation })}
            >
              {EDUCATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <NumberField
            label="BMI"
            value={form.bmi}
            min={10}
            max={60}
            step={0.1}
            error={errors.bmi}
            onChange={(bmi) => update({ bmi })}
          />
          <label className="factors-field">
            <span className="factors-label">吸烟状态</span>
            <select
              value={form.smokingStatus}
              onChange={(e) => {
                const v = e.target.value as "current" | "former";
                update({ smokingStatus: v, quitYears: v === "current" ? 0 : form.quitYears || 10 });
              }}
            >
              <option value="current">现在还在吸</option>
              <option value="former">已经戒了</option>
            </select>
          </label>
          <NumberField
            label="平均每天 支"
            value={form.cigarettesPerDay}
            min={1}
            max={80}
            error={errors.cigarettesPerDay}
            onChange={(cigarettesPerDay) => update({ cigarettesPerDay })}
          />
          <NumberField
            label="吸烟年限 年"
            value={form.smokingYears}
            min={0}
            max={70}
            error={errors.smokingYears}
            onChange={(smokingYears) => update({ smokingYears })}
          />
          <NumberField
            label="戒烟年数 年"
            value={form.quitYears}
            min={0}
            max={60}
            error={errors.quitYears}
            disabled={form.smokingStatus === "current"}
            onChange={(quitYears) => update({ quitYears })}
          />
        </div>

        <div className="factors-checks" style={{ marginTop: 14 }}>
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.copd}
              onChange={(e) => update({ copd: e.target.checked })}
            />
            <span className="factors-check-text">
              有慢支 / 肺气肿 / 慢阻肺
              <span className="factors-check-hint">COPD 是模型里的独立变量</span>
            </span>
          </label>
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.priorCancer}
              onChange={(e) => update({ priorCancer: e.target.checked })}
            />
            <span className="factors-check-text">
              有过其他恶性肿瘤
              <span className="factors-check-hint">不含肺癌</span>
            </span>
          </label>
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.familyLungCancer}
              onChange={(e) => update({ familyLungCancer: e.target.checked })}
            />
            <span className="factors-check-text">
              一级亲属有人得过肺癌
              <span className="factors-check-hint">父母、兄弟姊妹、子女</span>
            </span>
          </label>
        </div>

        <p className="foot-note">
          系数与常数项逐项取自 Tammemägi 2013（NEJM 368:728-736）表 2 与表注，包括吸烟强度的
          非线性变换与各变量的中心化取值。模型只对「曾经吸烟者」建模，年龄在 55–74 岁之外
          原文明说表现不确定。这里给的是人群模型的估计值，不是你的确定结局，也不替代医生判断。
        </p>
      </section>
    </main>
  );
}
