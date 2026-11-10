/**
 * 登录页/文档引用的对外数字：**唯一来源**
 *
 * 为什么要有这个文件：之前登录页写死「25 种疾病」「1.000 F1」，
 * 词表早就变成 26 种、F1 也换过口径，页面没人记得同步 —— 这就是"幻视"的来历。
 * 现在数字只在这里写一次，其他位置一律引用；
 * `metrics.test.ts` 会校验它与代码/评测产物一致，漂移会直接让测试失败。
 *
 * 改这里之前先跑评测，再把产物文件名写进 extractionEvalSet。
 */
export const METRICS = {
  /**
   * 用户能“识别”的具体疾病数：词表 26 条里去掉「其他」这个兜底桶。
   * 为什么不是 26：other 不是病名，它是「说不清的病」的收纳格，
   * 界面上（DiseaseCheatSheet）本来就不展示，所以对外说 25 才与产品一致。
   * 测试会校验：diseaseCount === DISEASES 里 code !== "other" 的条数。
   */
  diseaseCount: 25,
  /** FINDRISC / China-PAR / PLCOm2012 */
  riskModelCount: 3,
  /** 全部推理在本机 llama-server 上完成，代码里没有任何外部 API 调用 */
  localInferencePct: 100,
  /**
   * 口语抽取 F1：来自 docs/eval-results/ 下最近一份口语留出集产物。
   * 只报留出集，不报开发集（开发集是调参用的，1.000 没有意义）。
   */
  extractionF1: 1.0,
  extractionF1Text: "1.000",
  extractionEvalSet: "口语留出集 v9（30 条全新措辞，只跑一次）",
} as const;
