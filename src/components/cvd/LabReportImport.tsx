"use client";

import { useEffect, useRef, useState } from "react";
import type { MappedFields } from "@/lib/ocr/parse";
import type { LabItem } from "@/lib/ocr/parse";

/**
 * 化验单导入：拍照 → 本地视觉模型识别 → **用户逐项确认**后才填入 China-PAR 数字。
 *
 * 三条硬约束（见 docs/lab-ocr-verification.md）：
 *  1. 视觉模型不在线时整个入口不渲染，不留坏按钮；
 *  2. 识别结果只是候选，勾选并点「确认填入」才写入表单，绝不自动填；
 *  3. 图片只在内存里转 base64 发本机模型，不落盘、不入库。
 */

interface Props {
  onApply: (fields: MappedFields) => void;
}

const FIELD_LABEL: Record<keyof MappedFields, string> = {
  age: "年龄（岁）",
  sbp: "收缩压（mmHg）",
  totalCholesterolMmol: "总胆固醇（mmol/L）",
  hdlMmol: "高密度脂蛋白（mmol/L）",
  waistCm: "腰围（cm）",
};

export function LabReportImport({ onApply }: Props) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<LabItem[]>([]);
  const [fields, setFields] = useState<MappedFields>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // 只探一次：视觉模型在演示机上，不在线时不该出现这个入口
  useEffect(() => {
    let alive = true;
    fetch("/api/ocr")
      .then((r) => r.json())
      .then((d: { ready?: boolean }) => {
        if (alive) setReady(Boolean(d.ready));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return null;

  const MAX_BYTES = 8 * 1024 * 1024;
  const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

  async function onFile(file: File) {
    setError("");
    setItems([]);
    setFields({});
    setPicked(new Set());

    // 前端先挡一道：12MB 原图会被拼成 ~16MB base64 才发出去，
    // 网关多半先以 HTML 413 挡掉，用户看到的会是英文报错。
    if (file.size > MAX_BYTES) {
      setError("图片超过 8 MB，请压缩后再上传。");
      return;
    }
    if (file.type && !OK_TYPES.includes(file.type)) {
      setError("只支持 JPG / PNG / WebP。iPhone 的 HEIC 请先在相册里导出为 JPG。");
      return;
    }

    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const image = btoa(bin);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mime: file.type || "image/png" }),
        // 视觉模型偶尔会挂住：加超时，避免按钮一直转圈只能刷新页面
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await res.json()) as {
        items?: LabItem[];
        fields?: MappedFields;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `识别失败（${res.status}）`);
        return;
      }
      setItems(data.items ?? []);
      setFields(data.fields ?? {});
      // 默认全选已映射字段，用户取消不需要的那几项再确认
      setPicked(new Set(Object.keys(data.fields ?? {})));
    } catch (e) {
      // 不把技术性异常原文丢给用户（"Unexpected token '<'" 这类）
      const name = (e as Error)?.name;
      setError(
        name === "TimeoutError" || name === "AbortError"
          ? "识别超时了，请换一张更清晰的图片重试。"
          : "识别失败，请稍后重试或手动填写。",
      );
    } finally {
      setBusy(false);
    }
  }

  const mapped = Object.entries(fields) as Array<[keyof MappedFields, number]>;

  return (
    <div className="lab-import">
      <div className="lab-import-head">
        <span className="lab-import-title">从化验单导入</span>
        <button
          type="button"
          className="lab-import-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "识别中…" : "上传图片"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <p className="lab-import-hint">
        图片只在本机识别，不上传服务器、不保存。识别结果需要你确认后才会填入。
      </p>

      {error && <p className="lab-import-error">{error}</p>}

      {mapped.length > 0 && (
        <>
          <ul className="lab-import-list">
            {mapped.map(([key, value]) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(key)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(key);
                      else next.delete(key);
                      setPicked(next);
                    }}
                  />
                  <span className="lab-import-name">{FIELD_LABEL[key]}</span>
                  <span className="lab-import-value">{value}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="lab-import-apply"
            disabled={picked.size === 0}
            onClick={() => {
              const subset: MappedFields = {};
              for (const key of [...picked] as Array<keyof MappedFields>) {
                const v = fields[key];
                if (v !== undefined) subset[key] = v;
              }
              onApply(subset);
              setItems([]);
              setFields({});
              setPicked(new Set());
            }}
          >
            确认填入 {picked.size} 项
          </button>
        </>
      )}

      {items.length > 0 && mapped.length === 0 && (
        <p className="lab-import-error">
          识别到 {items.length} 项，但没有能对上本页字段的项目（本页只需要年龄、收缩压、总胆固醇、高密度脂蛋白）。
        </p>
      )}
    </div>
  );
}
