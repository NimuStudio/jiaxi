// 下载 Twemoji（CC-BY 4.0）彩色图标并渲染成 PPT 用 PNG。
// 用法：node scripts/deck_color_icons.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "docs", "deck-assets", "color");
mkdirSync(OUT, { recursive: true });

// 名称 -> Twemoji 码点（fe0f 省略）
const SET = {
  family: "1f468-200d-1f469-200d-1f467",   // 👨‍👩‍👧 家系
  dna: "1f9ec",                             // 🧬 抽取 / 遗传
  receipt: "1f4c4",                         // 📄 体检报告
  clipboard: "1f4cb",                       // 📋 问卷
  bulb: "1f4a1",                            // 💡 建议
  mic: "1f3a4",                             // 🎤 口述
  chart: "1f4ca",                           // 📊 风险
  seedling: "1f331",                        // 🌱 可回收
  robot: "1f916",                           // 🤖 抽取模型
  camera: "1f4f7",                          // 📷 化验单
  desktop: "1f5a5",                         // 🖥 本机
  shield: "1f6e1",                          // 🛡 隐私
  warning: "26a0",                          // ⚠️ 不宣称诊断
  question: "2753",                         // ❓ 不确定不显示
  blood: "1fa78",                           // 🩸 血糖
  heart: "1fac0",                           // 🫀 心血管
  lungs: "1fac1",                           // 🫁 肺癌
  scales: "2696",                           // ⚖️ 选型
  testtube: "1f9ea",                        // 🧪 微调实验
  puzzle: "1f9e9",                          // 🧩 差异化
  rocket: "1f680",                          // 🚀 落地
  busts: "1f465",                           // 👥 团队
  target: "1f3af",                          // 🎯 准确性
  chip: "1f4bb",                            // 💻 技术路线
  flag: "1f3c1",                            // 🏁 方案
  check: "2705",                            // ✅
  stopwatch: "23f1",                        // ⏱ 耗时
  package: "1f4e6",                         // 📦 依赖体积
};

const SIZE = 256;
const PAD = 14;
let ok = 0;
for (const [name, code] of Object.entries(SET)) {
  const url = `https://cdn.jsdelivr.net/npm/@twemoji/svg@latest/${code}.svg`;
  try {
    const res = await fetch(url);
    if (!res.ok) { console.log("  失败", name, res.status); continue; }
    const svg = Buffer.from(await res.arrayBuffer());
    const base = sharp(svg, { density: 600 }).resize(220, 220, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await base
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, name + ".png"));
    ok++;
    console.log("  ", name);
  } catch (e) {
    console.log("  异常", name, e.message);
  }
}
console.log("完成", ok, "/", Object.keys(SET).length, "->", OUT);
