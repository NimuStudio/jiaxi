"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASCVD_BAND_LABEL,
  evaluateChinapar,
  type AscvdBand,
  type ChinaparInput,
} from "@/lib/risk/chinapar";
import type { ExtractedPerson } from "@/lib/extract/client";
import { RELATION_LABEL, DISEASE_LABEL } from "@/lib/pedigree/viz";
import type { RelationType } from "@/lib/pedigree/types";
import { useCountUp } from "@/components/ui/useCountUp";
import { LabReportImport } from "@/components/cvd/LabReportImport";

/**
 * China-PAR 心血管风险页。
 *
 * 家族史不再靠用户自己回答「有没有」，而是直接从聊天页梳理出的家系里读：
 * 父母、兄弟姊妹中有人心梗/脑卒中（指南定义）即视为有心血管病家族史。
 * 这就是「家系 → 方程变量」的完整闭环。
 */

/** 指南定义的一级亲属（父母、兄弟姊妹——不含子女）。 */
const ASCVD_FIRST_DEGREE = new Set(["father", "mother", "brother", "sister"]);
const ASCVD_CONDITIONS = new Set(["myocardial-infarction", "stroke"]);

interface FhSource {
  relation: string;
  condition: string;
  onsetAge: number | null;
}

function readAscvdFamilyHistory(persons: ExtractedPerson[]): FhSource[] {
  return persons
    .filter((p) => ASCVD_FIRST_DEGREE.has(p.relation))
    .flatMap((p) =>
      p.conditions
        .filter((c) => ASCVD_CONDITIONS.has(c.code))
        .map((c) => ({ relation: p.relation, condition: c.code, onsetAge: c.onsetAge })),
    );
}

/** 论文示例人（Table 2 的默认值）：60 岁男性、未治疗 SBP130、TC 5.4、HDL 1.4、腰围 80…… */
const INITIAL: ChinaparInput = {
  age: 60,
  sex: "male",
  sbp: 130,
  onTreatment: false,
  totalCholesterolMmol: 5.4,
  hdlMmol: 1.4,
  waistCm: 80,
  smoker: false,
  diabetic: true,
  northern: true,
  urban: true,
  familyHistory: false,
};

function fmtPct(n: number): string {
  return (n * 100).toFixed(1).replace(/\.0$/, "");
}

/**
 * 输入有效性：清空输入框时 Number("") === 0，直接进方程会得到
 * ln(0) = -Infinity 之类的无意义结果（显示 0% 或 100%）。
 * 宁可显示「补全数字」，也不展示一个假的数字。
 */
function isValidInput(f: ChinaparInput): boolean {
  return (
    f.age >= 20 &&
    f.age <= 90 &&
    f.sbp >= 80 &&
    f.sbp <= 250 &&
    f.totalCholesterolMmol > 0 &&
    f.hdlMmol > 0 &&
    f.waistCm >= 40
  );
}

export default function CvdPage() {
  const [form, setForm] = useState<ChinaparInput>(INITIAL);
  /** 从家系图读到的家族史证据。 */
  const [fhSources, setFhSources] = useState<FhSource[]>([]);
  const [isPaperExample, setIsPaperExample] = useState(true);

  // 从聊天页存下的家系读心血管家族史（父母/兄弟姐妹心梗或脑卒中）
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pedigree-persons");
      if (!raw) return;
      const persons = JSON.parse(raw) as ExtractedPerson[];
      const hits = readAscvdFamilyHistory(persons);
      setFhSources(hits);
      // 自动勾选家族史会改变结果——必须同时摘掉「论文示例」标注，
      // 否则页面上会出现「写着示例 11.0%、显示的却是另一个数」的自相矛盾。
      if (hits.length > 0) {
        setForm((f) => ({ ...f, familyHistory: true }));
        setIsPaperExample(false);
      }
    } catch {
      /* 家系数据损坏时不影响手动填表 */
    }
  }, []);

  const valid = isValidInput(form);
  const result = useMemo(
    () => (valid ? evaluateChinapar(form) : null),
    [form, valid],
  );

  function update(patch: Partial<ChinaparInput>) {
    setForm((f) => ({ ...f, ...patch }));
    setIsPaperExample(false);
  }

  const isLow = result?.band === "low";
  // Hook 不能条件调用：result 为 null 时目标取 0，渲染时再判空
  const riskAnim = useCountUp(result?.risk ?? 0, 600);

  return (
    <main className="page">
      <div className="page-head">
        <h1 className="page-title">把家族史放进国家指南的方程里</h1>
        <p className="page-sub">
          China-PAR 心血管风险方程——如果你梳理过家系，一级亲属的心梗/脑卒中会自动变成方程里的变量。
        </p>
      </div>

      <section className="card">
        <p className="section-label">未来 10 年心血管病（ASCVD）风险 · China-PAR</p>

        {result ? (
          <>
            <div className="risk-headline">
              <span className={`risk-big${isLow ? " is-low" : ""}`}>
                {fmtPct(riskAnim)}
                <span className="risk-unit">%</span>
              </span>
              <span className={`band-chip${isLow ? " is-low" : ""}`}>
                {ASCVD_BAND_LABEL[result.band]}
              </span>
              <span className="risk-caption">
                分层：&lt;5% 低危 · 5–10% 中危 · ≥10% 高危
              </span>
            </div>

            {form.familyHistory && result.familyHistoryDelta !== null && (
              <p className="cvd-delta">
                家族史项影响：
                {result.familyHistoryDelta >= 0 ? "+" : ""}
                {fmtPct(Math.abs(result.familyHistoryDelta))} 个百分点
                {result.familyHistoryDelta < 0 &&
                  "（方程的年龄交互项：家族史对年轻人的边际影响更大）"}
              </p>
            )}
          </>
        ) : (
          <div className="risk-headline">
            <span className="risk-big">—</span>
            <span className="risk-caption">先把上面的数字填全，风险会实时重算</span>
          </div>
        )}

        {fhSources.length > 0 && (
          <div className="cvd-fh-note">
            <span className="cvd-fh-label">从你的家系图读出</span>
            {fhSources.map((s, i) => (
              <span key={i} className="cvd-fh-chip">
                {RELATION_LABEL[s.relation as RelationType] ?? s.relation}
                {DISEASE_LABEL[s.condition] ?? s.condition}
                {s.onsetAge !== null ? `（${s.onsetAge} 岁）` : ""}
              </span>
            ))}
            <p className="cvd-fh-hint">
              按指南定义（父母、兄弟姊妹中至少一人心梗或脑卒中），已自动勾选「心血管病家族史」。
            </p>
          </div>
        )}

        {form.sex === "female" && (
          <p className="cvd-fh-hint">
            女性方程不含家族史项——但家族史同样提示你需要关注，建议结合血脂血压定期检查。
          </p>
        )}

        <LabReportImport
          onApply={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />

        <div className="factors-grid cvd-grid">
          <label className="factors-field">
            <span className="factors-label">年龄</span>
            <input
              type="number"
              min={20}
              max={90}
              value={form.age}
              onChange={(e) => update({ age: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="factors-field">
            <span className="factors-label">性别</span>
            <select
              value={form.sex}
              onChange={(e) => update({ sex: e.target.value as "male" | "female" })}
            >
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>
          <label className="factors-field">
            <span className="factors-label">收缩压 mmHg</span>
            <input
              type="number"
              min={80}
              max={250}
              value={form.sbp}
              onChange={(e) => update({ sbp: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="factors-field">
            <span className="factors-label">总胆固醇 mmol/L</span>
            <input
              type="number"
              min={1}
              max={15}
              step={0.1}
              value={form.totalCholesterolMmol}
              onChange={(e) =>
                update({ totalCholesterolMmol: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label className="factors-field">
            <span className="factors-label">HDL 胆固醇 mmol/L</span>
            <input
              type="number"
              min={0.2}
              max={5}
              step={0.1}
              value={form.hdlMmol}
              onChange={(e) => update({ hdlMmol: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="factors-field">
            <span className="factors-label">腰围 cm</span>
            <input
              type="number"
              min={50}
              max={180}
              value={form.waistCm}
              onChange={(e) => update({ waistCm: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="factors-field">
            <span className="factors-label">地域</span>
            <select
              value={form.northern ? "north" : "south"}
              onChange={(e) => update({ northern: e.target.value === "north" })}
            >
              <option value="north">北方（长江以北）</option>
              <option value="south">南方</option>
            </select>
          </label>
          <label className="factors-field">
            <span className="factors-label">城乡</span>
            <select
              value={form.urban ? "urban" : "rural"}
              onChange={(e) => update({ urban: e.target.value === "urban" })}
            >
              <option value="urban">城市</option>
              <option value="rural">农村</option>
            </select>
          </label>
        </div>

        <div className="factors-checks">
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.onTreatment}
              onChange={(e) => update({ onTreatment: e.target.checked })}
            />
            <span className="factors-check-text">
              <span className="factors-check-label">两周内在服降压药</span>
              <span className="factors-check-hint">治疗与否走方程的不同分支</span>
            </span>
          </label>
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.smoker}
              onChange={(e) => update({ smoker: e.target.checked })}
            />
            <span className="factors-check-text">
              <span className="factors-check-label">现在吸烟</span>
              <span className="factors-check-hint">自报存在吸烟行为</span>
            </span>
          </label>
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.diabetic}
              onChange={(e) => update({ diabetic: e.target.checked })}
            />
            <span className="factors-check-text">
              <span className="factors-check-label">有糖尿病</span>
              <span className="factors-check-hint">确诊或正在治疗</span>
            </span>
          </label>
          <label className="factors-check">
            <input
              type="checkbox"
              checked={form.familyHistory}
              onChange={(e) => update({ familyHistory: e.target.checked })}
            />
            <span className="factors-check-text">
              <span className="factors-check-label">心血管病家族史</span>
              <span className="factors-check-hint">
                父母、兄弟姊妹中至少一人心梗或脑卒中
              </span>
            </span>
          </label>
        </div>

        <div className="cvd-verify">
          {isPaperExample ? (
            <p>
              当前默认值即论文示例（Circulation 2016 正文 Table 2）：60 岁、SBP 130、
              TC 5.4、HDL 1.4、腰围 80、不吸烟、有糖尿病、北方城市、无家族史 →
              男性 11.0%。本实现已通过该表全部 8 个验证点的回归测试。
            </p>
          ) : (
            <p>改动任何一项，风险实时重算（纯本地计算，不上传）。</p>
          )}
        </div>
      </section>

      <p className="foot-note">
        方程来源：China-PAR（Circulation 2016;134:1430-1440，系数见补充材料
        Table 1）；《中国心血管病风险评估和管理指南》（中国循环杂志 2019;34(1):4-28）；
        精确系数与女性基线生存率 0.9851 依据 T/JPMA 024-2024 附录 C/D。女性基线
        生存率在 Circulation 表格中印作 0.99（两位小数），与论文示例矛盾，按
        Table 2 四个年龄点反推并经团标确认。本页面为演示，不构成医疗建议。
      </p>
    </main>
  );
}
