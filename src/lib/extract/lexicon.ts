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
  /** 界面展示用的中文名。GBNF 枚举与界面标签都从这里派生。 */
  label: string;
  /** 展示分组（疾病清单弹层用）。纯展示元数据，不参与抽取与训练。 */
  category: string;
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
 *
 * 这是**唯一数据源**：GBNF 的枚举值、界面上的中文标签全部由它派生，
 * 避免「新增一个病种，却漏改语法或标签」这类不一致。
 *
 * 收录原则：只放普通人日常真的会说的说法；按语法性质分名词/谓语两类，
 * 避免生成病句污染训练数据。
 */
export const DISEASES: DiseaseSpec[] = [
  // —— 心脑血管 ——
  {
    category: "心脑血管",
    code: "myocardial-infarction",
    label: "心梗",
    nounAliases: ["心梗", "心肌梗死", "心肌梗塞"],
  },
  {
    category: "心脑血管",
    code: "coronary-heart-disease",
    label: "冠心病",
    // 注意：匹配是子串判断，所以「放了支架」无法命中「放了心脏支架」。
    // 核心名词与常见动词说法都要列全，否则整句会被当成「没有疾病词」而被过滤掉。
    nounAliases: ["冠心病", "心脏支架", "冠脉支架", "心脏血管堵"],
    verbAliases: [
      "放了支架",
      "放的支架",
      "放了心脏支架",
      "做了支架",
      "下了支架",
      "做了搭桥",
      "搭了桥",
      "心脏血管堵了",
    ],
  },
  {
    category: "心脑血管",
    code: "stroke",
    label: "脑卒中",
    nounAliases: [
      "脑梗",
      "脑溢血",
      "脑出血",
      "中风",
      "脑卒中",
      "脑血栓",
      "脑梗塞",
      "脑栓塞",
    ],
  },
  { category: "心脑血管", code: "hypertension", label: "高血压", nounAliases: ["高血压"], verbAliases: ["血压高"] },
  { category: "心脑血管", code: "heart-failure", label: "心衰", nounAliases: ["心衰", "心力衰竭"] },
  { category: "心脑血管", code: "atrial-fibrillation", label: "房颤", nounAliases: ["房颤", "心房颤动"] },

  // —— 代谢与肾脏 ——
  { category: "代谢与肾脏", code: "type2-diabetes", label: "糖尿病", nounAliases: ["糖尿病"], verbAliases: ["血糖高"] },
  { category: "代谢与肾脏", code: "gout", label: "痛风", nounAliases: ["痛风"] },
  {
    category: "代谢与肾脏",
    code: "chronic-kidney-disease",
    label: "慢性肾病",
    nounAliases: ["尿毒症", "肾病", "肾衰竭", "肾功能不全"],
  },

  // —— 呼吸 ——
  { category: "呼吸", code: "copd", label: "慢阻肺", nounAliases: ["慢阻肺", "肺气肿", "慢性支气管炎"] },
  { category: "呼吸", code: "asthma", label: "哮喘", nounAliases: ["哮喘"] },

  // —— 肿瘤 ——
  // 泛称必须单列：普通人最常说的就是「得了癌症/长了瘤子」，
  // 说不出具体癌种。缺了这条，整句会被预筛规则当成「无疾病词」丢弃，
  // 连模型都见不到（实测「我爸爸30岁有癌症」整句漏识别）。
  {
    category: "肿瘤",
    code: "cancer-unspecified",
    label: "癌症",
    nounAliases: ["癌症", "肿瘤", "恶性肿瘤", "瘤子", "瘤"],
  },
  { category: "肿瘤", code: "colorectal-cancer", label: "肠癌", nounAliases: ["肠癌", "结直肠癌", "大肠癌"] },
  { category: "肿瘤", code: "breast-cancer", label: "乳腺癌", nounAliases: ["乳腺癌"] },
  { category: "肿瘤", code: "gastric-cancer", label: "胃癌", nounAliases: ["胃癌"] },
  { category: "肿瘤", code: "lung-cancer", label: "肺癌", nounAliases: ["肺癌"] },
  { category: "肿瘤", code: "liver-cancer", label: "肝癌", nounAliases: ["肝癌"] },
  { category: "肿瘤", code: "esophageal-cancer", label: "食管癌", nounAliases: ["食管癌", "食道癌"] },
  { category: "肿瘤", code: "pancreatic-cancer", label: "胰腺癌", nounAliases: ["胰腺癌"] },
  { category: "肿瘤", code: "prostate-cancer", label: "前列腺癌", nounAliases: ["前列腺癌"] },
  { category: "肿瘤", code: "cervical-cancer", label: "宫颈癌", nounAliases: ["宫颈癌", "子宫颈癌"] },
  { category: "肿瘤", code: "kidney-cancer", label: "肾癌", nounAliases: ["肾癌"] },
  { category: "肿瘤", code: "leukemia", label: "白血病", nounAliases: ["白血病", "血癌"] },

  // —— 神经与精神 ——
  { category: "神经与精神", code: "dementia", label: "痴呆", nounAliases: ["老年痴呆", "阿尔茨海默", "痴呆"] },
  { category: "神经与精神", code: "parkinson", label: "帕金森", nounAliases: ["帕金森"] },

  // —— 兜底 ——
  // other 不设词条：既不参与「原文有依据」校验，也不会被口语过滤误删。
  { category: "", code: "other", label: "其他", nounAliases: [] },
];

/** 由关系枚举反查规范称谓（用于生成句子时挑选说法）。 */
export function relationsByType(relation: RelationType): RelationSpec | undefined {
  return RELATIONS.find((r) => r.relation === relation);
}
