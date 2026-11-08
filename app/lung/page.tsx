"use client";

import { useEffect, useMemo, useState } from "react";
import {
  evaluatePlco,
  formatRiskPercent,
  isEverSmoker,
  quitSmokingCounterfactual,
  PLCO_RANGE,
  type PlcoEducation,
  type PlcoInput,
  type PlcoRace,
} from "@/lib/risk/plcom2012";
import type { ExtractedPerson } from "@/lib/extract/client";
import { NumberField } from "@/components/cvd/NumberField";
import { RELATION_LABEL } from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";
import { readLungFamilyHistory, smokingSpanError } from "@/lib/risk/lungFamily";
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
  race: "white", // 引擎需要有值；界面另用 racePicked 控制"是否已选"
  
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

/**
 * 两个常用对照阈值（都不是我们编的）：
 * - 1.51%：英国肺癌筛查项目采用的门槛（PLCOm2012 6 年风险，见 UK 项目人群定义）；
 * - 1.3455%：Tammemägi 2013 原文里"与 NLST 入组条件等价"的阈值。
 * 注意别把 1.51% 说成 "UKLS" —— UKLS 试验用的是 LLPv2，不是这个数。
 */
const THRESHOLD_PROGRAM = 0.0151;
const THRESHOLD_NLST = 0.013455;

export default function LungRiskPage() {
  const [form, setForm] = useState<PlcoInput>(DEFAULTS);
  const [familyNote, setFamilyNote] = useState<string | null>(null);
  /**
   * 种族必须由用户自己选。
   * 模型是按人种分层的，默认「白人」会让绝大多数中国用户算出一个不对的数，
   * 而人种又没法从家系里推断 —— 所以宁可先不出数。
   */
  const [racePicked, setRacePicked] = useState<PlcoRace | null>(null);

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
  const quit = useMemo(() => quitSmokingCounterfactual(form), [form]);
  /** 包年 = 每天支数 ÷ 20 × 吸烟年限（临床通用说法，不参与计算，只是换个说法） */
  const packYears = (form.cigarettesPerDay / 20) * form.smokingYears;
  const anim = useCountUp(result.risk, 600);

  const FIELD_LABEL: Record<string, string> = {
    age: "年龄",
    bmi: "BMI",
    cigarettesPerDay: "每天支数",
    smokingYears: "吸烟年限",
    quitYears: "戒烟年数",
  };

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (form.age < PLCO_RANGE.minAge || form.age > PLCO_RANGE.maxAge)
      out.age = `应在 ${PLCO_RANGE.minAge}–${PLCO_RANGE.maxAge} 之间`;
    if (form.bmi < 10 || form.bmi > 60) out.bmi = "应在 10–60 之间";
    if (form.cigarettesPerDay < 1 || form.cigarettesPerDay > 80)
      out.cigarettesPerDay = "应在 1–80 之间";
    if (form.smokingYears < 0 || form.smokingYears > 70) out.smokingYears = "应在 0–70 之间";
    if (form.quitYears < 0 || form.quitYears > 60) out.quitYears = "应在 0–60 之间";
    // 自洽性：吸烟起点按 10 岁算，吸烟年限 + 戒烟年数不能超过年龄能容纳的上限
    if (!out.quitYears && !out.smokingYears) {
      const span = smokingSpanError(form.age, form.smokingYears, form.quitYears);
      if (span) out.quitYears = span;
    }
    return out;
  }, [form]);

  const invalid = Object.keys(errors).length > 0;
  const errorNames = Object.keys(errors).map((k) => FIELD_LABEL[k] ?? k).join("、");
  /** 从不吸烟者不在模型人群内：给数字就是误用，这里直接不给 */
  const notEverSmoker = !isEverSmoker(form);
  const noRace = racePicked === null;
  /** 引擎层清洗过输入（脏数据来自缓存/导入）→ 不给数字，避免"用一个兜底值算出来的风险" */
  const dirtyInput = result.sanitized.length > 0;
  const blocked = invalid || notEverSmoker || noRace || dirtyInput;
  const reachedProgram = result.risk >= THRESHOLD_PROGRAM;
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
      quitTime: form.smokingStatus === "current" ? "未戒烟（按 0 年计）" : "戒烟年数",
      bmi: "BMI",
      education: "教育",
      race: "种族",
    };
    return Object.entries(result.terms)
      .filter(([k]) => k !== "constant")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => ({ label: labels[k] ?? k, value: v }));
  }, [result.terms, form.smokingStatus]);

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

        {blocked ? (
          <div className="risk-headline">
            <span className="risk-big">—</span>
            <span className="risk-caption">
              {[
                noRace ? "先选一下种族 / 族裔（模型按人种分层，没法从家系推断）" : null,
                dirtyInput ? "有几项数值不合法（可能来自旧缓存），请重新填一下" : null,
                invalid ? `这几项需要修正：${errorNames}` : null,
                notEverSmoker ? "模型只对曾经吸烟者建模：把吸烟年限填上（≥1 年）才出数" : null,
              ]
                .filter(Boolean)
                .join("；")}
            </span>
          </div>
        ) : (
          <div className="risk-headline">
            <span className={`risk-big ${reachedProgram ? "is-high" : "is-low"}`}>
              {formatRiskPercent(anim)}
              <span className="risk-unit">%</span>
            </span>
            <span className={`band-chip ${reachedProgram ? "is-high" : "is-low"}`}>
              {reachedProgram ? "高于 1.51% 对照线" : "低于 1.51% 对照线"}
            </span>
            <span className="risk-caption">
              对照：6 年 ≥1.51%（英国筛查项目）· ≥1.35%（与 NLST 入组等价）
            </span>
          </div>
        )}

        {familyNote && <p className="cvd-fh-hint">{familyNote}</p>}

        {outsideValidatedAge && (
          <p className="cvd-delta">
            年龄 {form.age} 岁超出原文验证人群（55–74 岁），这个数字只能当参考。
          </p>
        )}

        {!blocked && (
          <p className="cvd-delta">
            抬高风险最多的三项：
            {topTerms
              .map((t) => `${t.label} ${t.value >= 0 ? "+" : "−"}${Math.abs(t.value).toFixed(2)}`)
              .join(" · ")}
            （相对模型中心值的对数优势贡献）
          </p>
        )}

        {!blocked && (
          <div className="reclaim-strip">
            <div className="reclaim-cell">
              <b>{formatRiskPercent(quit.now)}%</b>
              <span>按你现在的情况</span>
            </div>
            <span className="reclaim-arrow">→</span>
            <div className="reclaim-cell">
              <b className="is-goal">{formatRiskPercent(quit.quitNow)}%</b>
              <span>{form.smokingStatus === "current" ? "现在戒烟，其余不变" : "（你已戒烟）"}</span>
            </div>
            {quit.quit5yAgo !== null && (
              <>
                <span className="reclaim-arrow">→</span>
                <div className="reclaim-cell">
                  <b className="is-goal">{formatRiskPercent(quit.quit5yAgo)}%</b>
                  <span>如果 5 年前就戒了</span>
                </div>
              </>
            )}
          </div>
        )}
        {!blocked && (
          <p className="cvd-delta">
            家族史那部分是改不了的（对数优势 +{(result.terms.family ?? 0).toFixed(2)}），
            能动的只有吸烟：上面三个数字里唯一变化的就是吸烟相关的几项。
            饮食与运动不在这个模型里，别把它们折算进这个数。
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
            <select
              value={racePicked ?? ""}
              onChange={(e) => {
                const v = e.target.value as PlcoRace;
                setRacePicked(v);
                update({ race: v });
              }}
            >
              <option value="" disabled>请选择</option>
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
            <span className="factors-check-hint">
              原文用它代表社会经济地位，不是病因；每升一级 OR 0.92，影响很小
            </span>
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

        {!blocked && (
          <p className="cvd-delta">
            折算成临床上说的「包年」：{form.cigarettesPerDay} 支/天 × {form.smokingYears} 年 ≈{" "}
            <b>{packYears.toFixed(1)} 包年</b>
            （包年 = 每天支数 ÷ 20 × 年数）。这个数只用来和医生沟通，模型本身按支数和年限算。
          </p>
        )}

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
          非线性变换与各变量的中心化取值。模型只对「曾经吸烟者」建模——吸烟年限填 0 时这里不出数；
          年龄在 55–74 岁之外原文明说表现不确定。这里给的是人群模型的估计值，不是你的确定结局，
          也不替代医生判断；两个阈值只说明"是否够得上筛查条件"，不代表"该不该查"由它一个数决定。
        </p>
      </section>
    </main>
  );
}
