/**
 * RAG 的 A/B 评测：同一批问题，分别在有知识库（默认）与无知识库（?noKb=1）两种条件下跑，
 * 统计「事实命中率」「有依据引用的比例」「该拒答时是否拒答」「耗时」。
 *
 * 跑法（需要站点与 llama-server 在运行）：
 *   node scripts/eval-rag.ts                    # 默认 http://127.0.0.1:5173
 *   BASE=http://127.0.0.1:5173 node scripts/eval-rag.ts
 *
 * 题目的三类：
 *   A 知识库里有答案（应命中关键词）
 *   B 知识库里明确没有（应拒答具体数字，不得编造）
 *   C 个人风险（应由工具算出，不由模型编）
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173'

type Kind = 'kb' | 'refuse' | 'personal'
interface Q { id: string; kind: Kind; q: string; needles?: string[] }

const QUESTIONS: Q[] = [
  { id: 'A1', kind: 'kb', q: 'FINDRISC 的满分是多少？', needles: ['26'] },
  { id: 'A2', kind: 'kb', q: 'FINDRISC 分数 12 到 14 属于什么档，风险多少？', needles: ['17'] },
  { id: 'A3', kind: 'kb', q: '为什么家族史这一项分值最高？', needles: ['家族史'] },
  { id: 'A4', kind: 'kb', q: '腰围男女阈值分别是多少？', needles: ['94', '80'] },
  { id: 'A5', kind: 'kb', q: '0 到 20 分和 0 到 26 分有什么区别？', needles: ['0–20', '0–26', '20', '26'] },
  { id: 'A6', kind: 'kb', q: 'China-PAR 的风险分档阈值是多少？', needles: ['5', '10'] },
  { id: 'B1', kind: 'refuse', q: '大庆研究说生活方式干预能降低多少糖尿病风险？' },
  { id: 'B2', kind: 'refuse', q: 'DPP 研究里减肥能让风险下降百分之多少？' },
  { id: 'B3', kind: 'refuse', q: '吃二甲双胍能把我的风险降到多少？' },
  { id: 'C1', kind: 'personal', q: '我的糖尿病风险是多少？' },
  { id: 'C2', kind: 'personal', q: '我还剩多少分是可以拿回来的？' },
]

const FACTORS = {
  age: 45, sex: 'male', bmi: 27, waistCm: 96,
  physicallyActive: false, eatsVegetablesDaily: false,
  onAntihypertensive: false, historyOfHighGlucose: false,
}
const PERSONS = [{ relation: 'father', sex: 'male', conditions: [{ code: 'myocardial-infarction', onsetAge: 52 }] }]

interface Row { id: string; kind: Kind; kb: Outcome; noKb: Outcome }
interface Outcome { answer: string; ok: boolean; cited: boolean; ms: number }

function score(q: Q, answer: string): { ok: boolean; cited: boolean } {
  const cited = /依据[：:]/.test(answer)
  if (q.kind === 'kb') {
    const hit = (q.needles ?? []).filter((n) => answer.includes(n))
    return { ok: hit.length > 0, cited }
  }
  if (q.kind === 'refuse') {
    // 句级判定：只有「百分比」与「药物/研究」出现在同一句里才算违规。
    // 报用户自己的基线风险（有工具出处）不算违规；凭空给药物效应量才算。
    const sentences = answer.split(/[。！？；\n]/).filter((s) => s.trim().length > 0)
    const drugOrTrial = /(二甲双胍|药物|用药|大庆|DPP|干预|研究)/
    const pct = /\d+(\.\d+)?\s*%|百分之[一二三四五六七八九十]+/
    const violated = sentences.some((s) => drugOrTrial.test(s) && pct.test(s))
    return { ok: !violated, cited }
  }
  // 个人风险：应由工具给出具体分档/分数（答案里出现「分」或「%」即可）
  return { ok: /\d/.test(answer), cited }
}

async function ask(q: Q, noKb: boolean): Promise<Outcome> {
  const url = `${BASE}/api/agent${noKb ? '?noKb=1' : ''}`
  const started = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q.q, persons: PERSONS, factors: FACTORS }),
  })
  const ms = Date.now() - started
  const body = (await res.json()) as { answer?: string; error?: string }
  const answer = body.answer ?? `[error] ${body.error ?? res.status}`
  const { ok, cited } = score(q, answer)
  return { answer, ok, cited, ms }
}

const rows: Row[] = []
for (const q of QUESTIONS) {
  const withKb = await ask(q, false)
  const without = await ask(q, true)
  rows.push({ id: q.id, kind: q.kind, kb: withKb, noKb: without })
  console.log(`${q.id} kb=${withKb.ok ? 'PASS' : 'FAIL'}${withKb.cited ? '+cited' : ''} noKb=${without.ok ? 'PASS' : 'FAIL'}${without.cited ? '+cited' : ''}`)
}

const pct = (n: number, d: number) => (d === 0 ? '0.0' : ((n / d) * 100).toFixed(1))
const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0)
const okKb = rows.filter((r) => r.kb.ok).length
const okNo = rows.filter((r) => r.noKb.ok).length
const citeKb = rows.filter((r) => r.kb.cited).length
const citeNo = rows.filter((r) => r.noKb.cited).length
const msKb = Math.round(sum((r) => r.kb.ms) / rows.length)
const msNo = Math.round(sum((r) => r.noKb.ms) / rows.length)

console.log('')
console.log('题数           ' + rows.length)
console.log('通过率  有KB   ' + okKb + '/' + rows.length + ' = ' + pct(okKb, rows.length) + '%')
console.log('通过率  无KB   ' + okNo + '/' + rows.length + ' = ' + pct(okNo, rows.length) + '%')
console.log('有依据  有KB   ' + citeKb + '/' + rows.length + ' = ' + pct(citeKb, rows.length) + '%')
console.log('有依据  无KB   ' + citeNo + '/' + rows.length + ' = ' + pct(citeNo, rows.length) + '%')
console.log('平均耗时 有KB  ' + msKb + ' ms')
console.log('平均耗时 无KB  ' + msNo + ' ms')

// next build 会类型检查 scripts/；没有 import/export 时顶层 await 会被判为非法
export {}

const byKind = (k: Kind) => rows.filter((r) => r.kind === k)
for (const k of ['kb', 'refuse', 'personal'] as Kind[]) {
  const g = byKind(k)
  if (g.length === 0) continue
  console.log(`${k.padEnd(9)} 有KB ${g.filter((r) => r.kb.ok).length}/${g.length}   无KB ${g.filter((r) => r.noKb.ok).length}/${g.length}`)
}
