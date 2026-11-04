/**
 * 家系抽取词表：中文称谓 ↔ 关系枚举、口语病名 ↔ 疾病编码
 *
 * 【这份表的作用】
 *  1. 训练数据生成的唯一事实来源（先有结构再有句子，标注不会错）
 *  2. GBNF 枚举的取值来源（保证语法约束与业务模型一致）
 *  3. 评测集标注的参照标准
 *
 * 【重要说明 — 避免误用】
 *  - relation 取值是**本项目自定义的关系标识**，设计目的是对齐家系图布局，
 *    不是任何国际标准的编码体系。
 *  - disease 的 code 同样是**本项目内部的归一化命名**，用于聚合统计与规则判断，
 *    它不是 ICD-10 编码，也不代表临床诊断口径。若要对接 ICD-10，
 *    需要单独核对编码表后再引入，不能凭推测映射。
 *  - 称谓的「父系/母系」区分是中文亲属制度的事实（爷爷≠外公），
 *    这一部分属于语言学常识，不涉及医学判断。
 */

import type { RelationType, Sex } from "@/lib/pedigree/types";

export interface RelationSpec {
  relation: Exclude<RelationType, "self" | "spouse" | "unknown">;
  sex: Sex;
  /** 亲缘等级：1 = 一级，2 = 二级 */
  degree: 1 | 2;
  /** 常见口语说法（用于渲染句子与识别） */
  aliases: string[];
}

/**
 * 中文亲属称谓表。
 * 排序上刻意把最容易混淆的成对关系放在相邻位置，方便人工复核。
 */
export const RELATIONS: RelationSpec[] = [
  // —— 一级亲属 ——
  { relation: "father", sex: "male", degree: 1, aliases: ["我爸", "父亲", "老爸", "老爹", "俺爸", "我爸他"] },
  { relation: "mother", sex: "female", degree: 1, aliases: ["我妈", "母亲", "老妈", "老娘", "俺妈", "我妈她"] },
  { relation: "brother", sex: "male", degree: 1, aliases: ["我哥", "我弟弟", "哥哥", "弟弟", "我兄弟"] },
  { relation: "sister", sex: "female", degree: 1, aliases: ["我姐", "我妹妹", "姐姐", "妹妹", "我姐妹"] },
  { relation: "son", sex: "male", degree: 1, aliases: ["我儿子", "儿子"] },
  { relation: "daughter", sex: "female", degree: 1, aliases: ["我女儿", "女儿"] },

  // —— 二级亲属：父系祖辈 ——
  { relation: "paternal-grandfather", sex: "male", degree: 2, aliases: ["我爷爷", "爷爷", "我祖父"] },
  { relation: "paternal-grandmother", sex: "female", degree: 2, aliases: ["我奶奶", "奶奶", "我祖母"] },

  // —— 二级亲属：母系祖辈（与上面成对，最易混） ——
  { relation: "maternal-grandfather", sex: "male", degree: 2, aliases: ["我外公", "外公", "我姥爷", "姥爷", "我外祖父"] },
  { relation: "maternal-grandmother", sex: "female", degree: 2, aliases: ["我外婆", "外婆", "我姥姥", "姥姥", "我外祖母"] },

  // —— 二级亲属：父系旁系 ——
  { relation: "paternal-uncle", sex: "male", degree: 2, aliases: ["我伯伯", "我叔叔", "大伯", "叔叔", "我叔", "二伯", "三伯", "小叔", "三叔"] },
  { relation: "paternal-aunt", sex: "female", degree: 2, aliases: ["我姑姑", "姑姑", "我姑妈", "姑妈", "我姑", "大姑", "小姑", "二姑"] },

  // —— 二级亲属：母系旁系（与上面成对） ——
  { relation: "maternal-uncle", sex: "male", degree: 2, aliases: ["我舅舅", "舅舅", "我舅"] },
  { relation: "maternal-aunt", sex: "female", degree: 2, aliases: ["我姨妈", "姨妈", "我姨", "姨母", "我小姨", "大姨", "二姨", "三姨"] },
];

export interface DiseaseSpec {
  code: string;
  /** 名词性说法，可接「有 / 得了 / 是」 */
  nounAliases: string[];
  /**
   * 谓语性说法：本身即可作谓语（如「放了支架」），
   * 不能塞进「有 X」句式，否则会生成「有放了支架」这类病句。
   */
  verbAliases?: string[];
}

/**
 * 疾病词表。code 为本项目内部归一化标识（非 ICD-10）。
 * 收录原则：只放普通人日常真的会说的说法，并按语法性质分成两类，
 * 避免生成病句污染训练数据。
 */
export const DISEASES: DiseaseSpec[] = [
  { code: "myocardial-infarction", nounAliases: ["心梗", "心肌梗死"] },
  {
    code: "coronary-heart-disease",
    nounAliases: ["冠心病"],
    verbAliases: ["放了支架", "做了搭桥", "心脏血管堵了"],
  },
  { code: "stroke", nounAliases: ["脑梗", "脑溢血", "脑出血", "中风", "脑卒中", "脑血栓", "脑梗塞", "脑栓塞"] },
  { code: "hypertension", nounAliases: ["高血压"], verbAliases: ["血压高"] },
  { code: "type2-diabetes", nounAliases: ["糖尿病"], verbAliases: ["血糖高"] },
  { code: "colorectal-cancer", nounAliases: ["肠癌", "结直肠癌", "大肠癌"] },
  { code: "breast-cancer", nounAliases: ["乳腺癌"] },
  { code: "gastric-cancer", nounAliases: ["胃癌"] },
  { code: "lung-cancer", nounAliases: ["肺癌"] },
];

/** 由关系枚举反查规范称谓（用于生成句子时挑选说法）。 */
export function relationsByType(relation: RelationType): RelationSpec | undefined {
  return RELATIONS.find((r) => r.relation === relation);
}
