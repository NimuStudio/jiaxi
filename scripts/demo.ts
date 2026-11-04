/**
 * 演示脚本：展示「可回收风险」的完整计算。
 * 运行：node scripts/demo.ts
 */
import { evaluateFindrisc } from "../src/lib/risk/findrisc.ts";

// 案例：48 岁男性，母亲有糖尿病（一级亲属），生活方式一般，血压偏高在服药。
const result = evaluateFindrisc({
  age: 48,
  bmi: 27,
  waistCm: 96,
  sex: "male",
  physicallyActive: false,
  eatsVegetablesDaily: false,
  onAntihypertensive: true,
  historyOfHighGlucose: false,
  familyHistory: "first",
});

const { breakdown, current, best, reclaimablePoints } = result;

console.log("========== 家系 · FINDRISC 演示 ==========");
console.log("");
console.log("逐项得分：");
console.log(`  年龄 48        -> ${breakdown.age} 分`);
console.log(`  BMI 27         -> ${breakdown.bmi} 分`);
console.log(`  腰围 96        -> ${breakdown.waist} 分`);
console.log(`  不运动         -> ${breakdown.physicalActivity} 分`);
console.log(`  不吃蔬果       -> ${breakdown.diet} 分`);
console.log(`  服降压药       -> ${breakdown.antihypertensive} 分`);
console.log(`  高血糖史       -> ${breakdown.highGlucose} 分`);
console.log(`  一级亲属糖尿病 -> ${breakdown.familyHistory} 分`);
console.log("");
console.log(`当前总分：${result.score}，10 年糖尿病风险 ${current.tenYearRiskPercent}%（${current.band}）`);
console.log(`可回收分数：${reclaimablePoints} 分（BMI、腰围、运动、饮食）`);
console.log(`如果全部达标：总分降到 ${best.tenYearRiskPercent === current.tenYearRiskPercent ? best.score : result.bestAchievableScore}，风险降到 ${best.tenYearRiskPercent}%（${best.band}）`);
console.log("");
console.log("一句话：");
console.log(`  10 年风险从 ${current.tenYearRiskPercent}% 降到 ${best.tenYearRiskPercent}%，`);
console.log(`  中间 ${reclaimablePoints} 分是可以靠自己拿回来的。`);
