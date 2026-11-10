// 用 Material Symbols（Apache 2.0）渲染 PPT 图标：单色但按语义分组着色。
// 用法：node scripts/deck_mat_icons.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "docs", "deck-assets", "mat");
mkdirSync(OUT, { recursive: true });

// 语义配色：医学=墨青，数据/技术=主蓝，警示=红
const TONE = {
  medical: "#0F7C8C",
  tech: "#1A6FB5",
  warn: "#B42318",
  nav: "#1A6FB5",
};

// 文件名 -> [Material 图标名, 色调]
const SET = {
  family: ["family_history", "medical"],
  dna: ["genetics", "medical"],
  report: ["description", "tech"],
  survey: ["fact_check", "tech"],
  bulb: ["lightbulb", "tech"],
  mic: ["mic", "tech"],
  chart: ["monitoring", "tech"],
  reclaim: ["trending_up", "medical"],
  blood: ["bloodtype", "medical"],
  heart: ["cardiology", "medical"],
  lungs: ["pulmonology", "medical"],
  target: ["track_changes", "tech"],
  scales: ["balance", "tech"],
  flask: ["science", "tech"],
  shield: ["health_and_safety", "medical"],
  chip: ["memory", "tech"],
  server: ["dns", "tech"],
  desktop: ["computer", "tech"],
  diff: ["compare_arrows", "tech"],
  launch: ["rocket_launch", "tech"],
  team: ["groups", "tech"],
  timer: ["timer", "tech"],
  flag: ["flag", "tech"],
  check: ["check_circle", "medical"],
  package: ["inventory_2", "tech"],
  robot: ["smart_toy", "tech"],
  camera: ["photo_camera", "tech"],
  db: ["database", "tech"],
  warning: ["warning", "warn"],
  question: ["help", "warn"],
  lock: ["lock", "tech"],
  route: ["schema", "tech"],
  chat: ["mode_comment", "tech"],
  // 旧名别名：让历史引用也能解析，不至于回落到线框图
  tree: ["account_tree", "medical"],
  gauge: ["speed", "medical"],
  play: ["play_circle", "tech"],
  calc: ["calculate", "tech"],
  balance: ["balance", "tech"],
  layers: ["layers", "tech"],
  lock: ["lock", "tech"],
  server: ["dns", "tech"],
  db: ["database", "tech"],
  trend: ["trending_up", "medical"],
  testtube: ["science", "tech"],
  seedling: ["eco", "medical"],
  puzzle: ["extension", "tech"],
  rocket: ["rocket_launch", "tech"],
  busts: ["groups", "tech"],
  receipt: ["description", "tech"],
  clipboard: ["fact_check", "tech"],
  stopwatch: ["timer", "tech"],
};

const SIZE = 232;
const PAD = 12;
const BASE = "https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@latest/rounded/";

let ok = 0;
const missing = [];
for (const [name, [glyph, tone]] of Object.entries(SET)) {
  try {
    const res = await fetch(BASE + glyph + ".svg");
    if (!res.ok) { missing.push(name + "(" + glyph + ")"); continue; }
    let svg = await res.text();
    // 单色填充：把 fill 注入到每个 path（Material 原图为纯黑）
    svg = svg.replace(/<path /g, '<path fill="' + TONE[tone] + '" ');
    const buf = Buffer.from(svg);
    await sharp(buf, { density: 600 })
      .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, name + ".png"));
    ok++;
  } catch (e) {
    missing.push(name + ":" + e.message);
  }
}
console.log("渲染完成", ok, "/", Object.keys(SET).length);
if (missing.length) console.log("缺失:", missing.join(", "));
