// 用 simple-icons 里官方的品牌矢量，渲染成 PPT 用的 PNG（透明底、统一留白）。
// 用法：node scripts/deck_brand_icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as si from "simple-icons";

const OUT = path.join(process.cwd(), "docs", "deck-assets", "brand");
mkdirSync(OUT, { recursive: true });

// slug -> 文件名
const WANT = {
  nextdotjs: "nextjs",
  react: "react",
  typescript: "typescript",
  nodedotjs: "nodejs",
  mysql: "mysql",
  nvidia: "nvidia",
  python: "python",
  docker: "docker",
  git: "git",
  linux: "linux",
  huggingface: "huggingface",
  pytorch: "pytorch",
  pnpm: "pnpm",
  vitest: "vitest",
};

const SIZE = 256;
const PAD = 18;

let ok = 0;
for (const [slug, name] of Object.entries(WANT)) {
  const key = "si" + slug.charAt(0).toUpperCase() + slug.slice(1);
  const icon = si[key];
  if (!icon) {
    console.log("  缺失:", slug);
    continue;
  }
  const inner = SIZE - PAD * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${inner}" height="${inner}"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`;
  await sharp(Buffer.from(svg))
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT, name + ".png"));
  ok++;
  console.log("  ", name, "#" + icon.hex);
}
console.log("完成", ok, "个 ->", OUT);
