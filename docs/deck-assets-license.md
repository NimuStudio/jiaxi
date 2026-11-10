# 答辩 PPT 素材来源与许可

所有图标的来源、许可与生成方式登记在这里。**外部素材必须署名**，自绘素材记录生成脚本，
这样任何人拿到这份 PPT 都能核对每个图形的来路。

## 1. 彩色图标（页面与卡片）

| 项 | 内容 |
| --- | --- |
| 来源 | [Twemoji](https://github.com/jdecked/twemoji)（Twitter 开源 emoji 集） |
| 许可 | **CC-BY 4.0** —— 使用时必须署名 |
| 获取 | `https://cdn.jsdelivr.net/npm/@twemoji/svg@latest/<码点>.svg` |
| 处理 | `scripts/deck_color_icons.mjs` 下载 SVG，用 sharp 渲染为 256×256 PNG（透明底、留白 14px） |
| 产物 | `docs/deck-assets/color/*.png`（28 个） |
| 署名文字 | "Emoji graphics: Twemoji by Twitter, Inc. and contributors, CC-BY 4.0" |

用到的码点见脚本内的 `SET` 表（家系 👨‍👩‍👧、DNA 🧬、血滴 🩸、心脏 🫀、肺 🫁、显微镜类概念等）。

## 2. 品牌官方图标（技术栈与部署图）

| 项 | 内容 |
| --- | --- |
| 来源 | [simple-icons](https://simpleicons.org/)（各品牌官方矢量路径） |
| 许可 | 图标数据 **CC0 1.0**；品牌商标归各自所有者，仅用于标识技术栈 |
| 处理 | `scripts/deck_brand_icons.mjs` 用 sharp 渲染，按各品牌官方色着色 |
| 产物 | `docs/deck-assets/brand/*.png`（14 个：Next.js / React / TypeScript / Node.js / MySQL / NVIDIA / Python / Docker / Git / Linux / Hugging Face / PyTorch / pnpm / Vitest） |

> llama.cpp 与 Qwen 没有官方品牌图标，**没有伪造**，这两处使用自绘线性图标。

## 3. 自绘图标与图形（无外部来源）

| 项 | 内容 |
| --- | --- |
| 生成脚本 | `scripts/deck_icons.py`（双色线性图标 29 个）、`scripts/deck_art2.py`（六套栏目背景、中性背景、笔记本/浏览器外框、封面刊头）、`scripts/deck_art.py`（三代家系示意图） |
| 许可 | 随本项目 |
| 产物 | `docs/deck-assets/icons/`、`docs/deck-assets/*.jpg`、`docs/deck-assets/pedigree-scene.png` |

## 4. 产品截图

`docs/screenshots/*.png` —— 由本项目站点实际运行界面截取，套上程序生成的设备外框后使用。

## 复现

```bash
node scripts/deck_color_icons.mjs   # 彩色图标（需要联网）
node scripts/deck_brand_icons.mjs   # 品牌图标（需要联网）
python scripts/deck_icons.py        # 自绘线框图标
python scripts/deck_art.py          # 家系示意图
python scripts/deck_art2.py         # 背景与设备外框
python scripts/build_deck_v2.py     # 生成 PPT
```
