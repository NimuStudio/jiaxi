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

/** 标题命中时的加权倍数：短问题里正文提到同一词条名的条目会挤掉真正的答案条目 */
const TITLE_BOOST = 1.6;

const DIABETES_HINT = /(糖尿病|血糖|胰岛素|糖化|糖耐|口服糖|FINDRISC|空腹)/i;
const ASCVD_HINT = /(心血管|血压|血脂|胆固醇|心梗|心绞痛|脑卒中|中风|冠心病|China-?PAR|ASCVD)/i;

/**
 * 判断问题属于哪个主题。
 *
 * 这是修「张冠李戴」的关键：知识库里 diabetes 与 ascvd 共用「家族史」「阈值」等 tag，
 * 只靠 tag 字面匹配会让《心血管病家族史怎么进入 China-PAR》成为糖尿病家族史问题的依据。
 */
export function questionTopic(question: string): KbTopic | "any" | "mixed" {
  const d = DIABETES_HINT.test(question);
  const a = ASCVD_HINT.test(question);
  if (d && a) return "mixed";
  if (d) return "diabetes";
  if (a) return "ascvd";
  return "any";
}

/** 条目能否作为这个问题的依据（主题必须兼容） */
export function topicCompatible(question: string, entry: KnowledgeEntry): boolean {
  const topic = entry.topic ?? "both";
  if (topic === "both") return true;
  const q = questionTopic(question);
  if (q === "any" || q === "mixed") return true; // 问题本身没限定主题时不额外否决
  return q === topic;
}


/**
 * 虚词表：这些 2-gram 在任何问题里都会出现，命中它们不代表话题相关。
 * 语料只有十几条时，仅靠 BM25 分数下限挡不住「今天天气怎么样」这类问句——
 * 实测它也能拿到 1.8 以上的分数并返回一条不相干的"依据"。
 * 因此额外要求：至少命中一个**实词**，否则视为查不到。
 */
export const STOP_TOKENS = new Set([
  "今天", "天气", "怎么", "什么", "多少", "哪些", "如何", "可以", "应该",
  "我的", "我是", "这个", "那个", "一下", "请问", "是不", "不是", "有没",
  "么样", "怎么样", "是什", "有什", "么的", "的吗", "呢吗",
]);

/** 条目所属主题：用于门控「问糖代谢却引心血管条目」这类张冠李戴 */
export type KbTopic = "diabetes" | "ascvd" | "both";

export interface KnowledgeEntry {
  id: string;
  title: string;
  text: string;
  source: string;
  tags: string[];
  topic?: KbTopic;
}

export interface ScoredEntry extends KnowledgeEntry {
  score: number;
  /** 问题实词被该条目覆盖的比例（0~1），用于过滤「结构相似但主题无关」的命中 */
  coverage?: number;
  /** 命中的实词个数（虚词不算），用于过滤"看起来有关其实无关"的检索结果 */
  meaningfulHits?: number;
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
    let meaningfulHits = 0;
    for (const q of new Set(qTokens)) {
      const f = tf.get(q) ?? 0;
      if (f === 0) continue;
      if (!STOP_TOKENS.has(q)) meaningfulHits += 1;
      const n = df.get(q) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const denom = f + K1 * (1 - B + (B * d.tokens.length) / Math.max(avgLen, 1));
      score += idf * ((f * (K1 + 1)) / denom);
    }

    // 标题命中加权：短问题里正文提到同一个词条名的条目会挤掉真正的答案条目
    // （实测「FINDRISC 的满分是多少」命中了《可回收这个说法是怎么来的》）。
    // 标题重合更接近「这篇讲的就是这个」，因此给固定倍数。
    // 标题加权只认实词：以前把「怎么」「这个」这类停用词也算进标题重合，
    // 结果是「腰围怎么量」把《「可回收」这个说法是怎么来的》顶到第一条。
    const titleTokens = new Set(tokenize(d.entry.title).filter((t) => !STOP_TOKENS.has(t)));
    const queryContent = new Set([...new Set(qTokens)].filter((t) => !STOP_TOKENS.has(t)));
    if ([...queryContent].some((t) => titleTokens.has(t))) score *= TITLE_BOOST;

    // 实词覆盖率：命中几个「问题里的实词」决定这条到底在不在讲这件事。
    // 只靠分数不够——「光合作用是什么」也能靠「作用」这类 2-gram 拿到 4.7 分。
    const docSet = new Set(d.tokens);
    const qContentList = [...new Set(qTokens)].filter((t) => !STOP_TOKENS.has(t));
    const covered = qContentList.filter((t) => docSet.has(t)).length;
    const coverage = qContentList.length > 0 ? covered / qContentList.length : 0;

    return { ...d.entry, score, meaningfulHits, coverage };
  });

  // 阈值按当前语料规模标定：相关问题的首条得分通常在 3 以上，
  // 而无关问题（如「今天天气」）靠「怎么」「什么」这类 2-gram 也能拿到 1.5 左右。
  // 取 1.8 作为下限，宁可回答「没找到」，也不给一条不相干的依据。
  const MIN_SCORE = 1.8;

  // 注：曾试过再加一道「实词覆盖率 ≥ 0.5 / 命中 ≥ 2」的门槛，实测会把
  // 「腰围怎么量」「大庆研究能降低多少风险」这类正常问句一起杀掉，
  // 而「光合作用是什么」仍能靠 2-gram 命中。启发式解决不了这个问题，
  // 真正的解法是给知识库条目加主题标签并要求主题一致（见 docs/audit.md）。
  return scored
    .filter((s) => s.score >= MIN_SCORE && (s.meaningfulHits ?? 0) > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
