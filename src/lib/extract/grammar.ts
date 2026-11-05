/**
 * 家系抽取的 GBNF 约束语法（llama.cpp）
 *
 * 作用：把模型的输出锁死在一个严格的 JSON 结构里。
 * 只要语法通过编译，输出就一定可以被 JSON.parse —— 不存在「模型多说了一句话
 * 导致解析失败」这类问题。这是本地推理相对云 API 的一个实打实的优势：
 * 云端只能靠 prompt 祈祷格式正确，这里是从解码层面强制。
 *
 * 字段设计与 src/lib/pedigree/types.ts 对齐。
 */
import { DISEASES } from "./lexicon.ts";

/**
 * 疾病枚举由词表派生，且刻意使用**中文**而不是英文编码。
 *
 * 原因：模型本来就能认出「肝癌」「老年痴呆」这些中文病名，
 * 但要求它直接吐出 "liver-cancer" 这种英文编码等于额外增加一层记忆负担，
 * 实测新增病种的识别率会掉到接近零。让它说中文，后端再映射成编码，
 * 既准确又不依赖示例覆盖每一个病种。
 *
 * 枚举范围 = 规范标签 + 全部名词性别名（如「肿瘤」「瘤子」）：
 * 模型照抄原文的口语说法也能落进枚举，后端统一映射回编码。
 * 谓语性说法（「放了支架」「血压高」）不进枚举——它们不能作宾语，
 * 放进来会诱导模型输出「有放了支架」这类病句。
 */
const DISEASE_UNION = [
  ...new Set(
    DISEASES.flatMap((d) => [d.label, ...d.nounAliases]),
  ),
]
  .map((w) => `"\\"${w}\\""` )
  .join(" | ");

export const PEDIGREE_GBNF = String.raw`
root ::= "{" ws "\"persons\"" ws ":" ws persons ws "}"
persons ::= "[" ws (person (ws "," ws person)*)? ws "]"
person ::= "{" ws "\"relation\"" ws ":" ws rel ws "," ws "\"sex\"" ws ":" ws sex ws "," ws "\"conditions\"" ws ":" ws conds ws "}"
conds ::= "[" ws (cond (ws "," ws cond)*)? ws "]"
cond ::= "{" ws "\"code\"" ws ":" ws dis ws "," ws "\"onsetAge\"" ws ":" ws age ws "}"
rel ::= "\"self\"" | "\"father\"" | "\"mother\"" | "\"brother\"" | "\"sister\"" | "\"son\"" | "\"daughter\"" | "\"paternal-grandfather\"" | "\"paternal-grandmother\"" | "\"maternal-grandfather\"" | "\"maternal-grandmother\"" | "\"paternal-uncle\"" | "\"paternal-aunt\"" | "\"maternal-uncle\"" | "\"maternal-aunt\"" | "\"unknown\""
sex ::= "\"male\"" | "\"female\"" | "\"unknown\""
dis ::= ${DISEASE_UNION}
age ::= "null" | [0-9] [0-9]?
ws ::= [ \t\n]*
`;
