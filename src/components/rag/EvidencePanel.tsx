"use client";

import { useState } from "react";

interface ScoredEntry {
  id: string;
  title: string;
  text: string;
  source: string;
  score: number;
}

const SUGGESTIONS = [
  "为什么家族史这么重要",
  "腰围为什么要分男女",
  "这些百分比是怎么来的",
  "为什么只给分层不给概率",
];

/**
 * 依据面板
 *
 * 每个数字都能问「凭什么」。检索到的每条都带出处，检索不到就直说没找到——
 * 宁可承认不知道，也不让模型编一段听起来很专业的话。
 */
export function EvidencePanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ScoredEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length === 0 || loading) return;
    setQuery(text);
    setLoading(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = (await res.json()) as { results?: ScoredEntry[] };
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <p className="section-label">这些数字凭什么</p>

      <p className="kb-lead">
        下面每个数字都能问出处。答案来自已核实过的知识库，不给推测。
      </p>

      <form
        className="kb-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(query);
        }}
      >
        <input
          className="kb-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：为什么家族史的权重这么高"
          disabled={loading}
        />
        <button className="kb-ask" type="submit" disabled={loading || !query.trim()}>
          {loading ? "查…" : "查依据"}
        </button>
      </form>

      {results === null && (
        <div className="kb-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="kb-chip"
              onClick={() => void ask(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {results !== null && (
        <div className="kb-results">
          {results.length === 0 ? (
            <p className="kb-empty">
              知识库里没有与这个问题匹配的条目。与其给一个听起来合理的答案，不如直接说没有。
            </p>
          ) : (
            results.map((r) => (
              <article className="kb-item" key={r.id}>
                <h4 className="kb-title">{r.title}</h4>
                <p className="kb-text">{r.text}</p>
                <p className="kb-source">出处：{r.source}</p>
              </article>
            ))
          )}
          <button
            type="button"
            className="kb-reset"
            onClick={() => {
              setResults(null);
              setQuery("");
            }}
          >
            换个问题
          </button>
        </div>
      )}
    </section>
  );
}
