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
export const PEDIGREE_GBNF = String.raw`
root ::= "{" ws "\"persons\"" ws ":" ws persons ws "}"
persons ::= "[" ws (person (ws "," ws person)*)? ws "]"
person ::= "{" ws "\"relation\"" ws ":" ws rel ws "," ws "\"sex\"" ws ":" ws sex ws "," ws "\"conditions\"" ws ":" ws conds ws "}"
conds ::= "[" ws (cond (ws "," ws cond)*)? ws "]"
cond ::= "{" ws "\"code\"" ws ":" ws dis ws "," ws "\"onsetAge\"" ws ":" ws age ws "}"
rel ::= "\"self\"" | "\"father\"" | "\"mother\"" | "\"brother\"" | "\"sister\"" | "\"son\"" | "\"daughter\"" | "\"paternal-grandfather\"" | "\"paternal-grandmother\"" | "\"maternal-grandfather\"" | "\"maternal-grandmother\"" | "\"paternal-uncle\"" | "\"paternal-aunt\"" | "\"maternal-uncle\"" | "\"maternal-aunt\"" | "\"unknown\""
sex ::= "\"male\"" | "\"female\"" | "\"unknown\""
dis ::= "\"myocardial-infarction\"" | "\"coronary-heart-disease\"" | "\"stroke\"" | "\"hypertension\"" | "\"type2-diabetes\"" | "\"colorectal-cancer\"" | "\"breast-cancer\"" | "\"gastric-cancer\"" | "\"lung-cancer\"" | "\"other\""
age ::= "null" | [0-9] [0-9]?
ws ::= [ \t\n]*
`;
