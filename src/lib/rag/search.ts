/**
 * 知识库检索（BM25）
 *
 * 为什么不用向量检索：
 *  语料只有十几条，向量模型要额外加载几百 MB、增加一次推理往返，
 *  而 BM25 在关键词重合度高的中文短文本上表现并不差。
 *  检索策略应当匹配语料规模，为小语料上向量模型是过度设计。
 *
 * 中文没有空格分词，这里用字符 2-gram 作为近似切分——
 * 对「家族史」「腰围」这类专业词足够，也不依赖分词词典。
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  text: string;
  source: string;
  tags: string[];
}

export interface ScoredEntry extends KnowledgeEntry {
  score: number;
}

const CJK = /[\u4e00-\u9fa5]/;

/** 中文按 2-gram 切分，英文数字按词切分。 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, " ");

  for (const chunk of cleaned.split(/\s+/)) {
    if (chunk.length === 0) continue;

    if (!CJK.test(chunk)) {
      tokens.push(chunk.toLowerCase());
      continue;
    }

    if (chunk.length === 1) {
      tokens.push(chunk);
      continue;
    }
    for (let i = 0; i < chunk.length - 1; i++) {
      tokens.push(chunk.slice(i, i + 2));
    }
  }
  return tokens;
}

const K1 = 1.5;
const B = 0.75;

/**
 * 检索最相关的条目。只返回得分大于 0 的结果——
 * 与其给一条不相关的「依据」，不如坦白说没找到。
 */
export function searchKnowledge(
  query: string,
  entries: KnowledgeEntry[],
  topK = 3,
): ScoredEntry[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0 || entries.length === 0) return [];

  const docs = entries.map((entry) => ({
    entry,
    tokens: tokenize(`${entry.title} ${entry.text} ${entry.tags.join(" ")}`),
  }));

  const N = docs.length;
  const avgLen =
    docs.reduce((sum, d) => sum + d.tokens.length, 0) / Math.max(N, 1);

  const df = new Map<string, number>();
  for (const d of docs) {
    for (const t of new Set(d.tokens)) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  const scored: ScoredEntry[] = docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const q of new Set(qTokens)) {
      const f = tf.get(q) ?? 0;
      if (f === 0) continue;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + K1 * (1 - B + (B * d.tokens.length) / Math.max(avgLen, 1));
      score += idf * ((f * (K1 + 1)) / denom);
    }

    return { ...d.entry, score };
  });

  // 阈值按当前语料规模标定：相关问题的首条得分通常在 3 以上，
  // 而无关问题（如「今天天气」）靠「怎么」「什么」这类 2-gram 也能拿到 1.5 左右。
  // 取 1.8 作为下限，宁可回答「没找到」，也不给一条不相干的依据。
  const MIN_SCORE = 1.8;

  return scored
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
