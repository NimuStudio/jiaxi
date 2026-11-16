// SVG -> PNG：用 @resvg/resvg-js（Rust 实现，走系统字体，Windows 下能正确解析「微软雅黑」）
// 用法：node scripts/svg2png.mjs <in.svg> <out.png> [width]
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const [, , inPath, outPath, w] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node svg2png.mjs <in.svg> <out.png> [width]");
  process.exit(1);
}
const svg = readFileSync(inPath, "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: Number(w || 2000) },
  background: "rgba(0,0,0,0)",
  font: {
    loadSystemFonts: true,
    // 明确给出默认族，避免 resvg 在缺省字体时回落到无 CJK 的西文字体
    defaultFontFamily: "Microsoft YaHei",
    sansSerifFamily: "Microsoft YaHei",
  },
});
const png = resvg.render().asPng();
writeFileSync(outPath, png);
console.log("PNG ->", outPath, png.length, "字节");
