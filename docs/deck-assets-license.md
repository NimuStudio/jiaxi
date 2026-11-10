# 答辩 PPT 素材来源与许可

所有图标的来源、许可与生成方式登记在这里。**外部素材必须署名**，自绘素材记录生成脚本，
这样任何人拿到这份 PPT 都能核对每个图形的来路。

## 1. 图标：Material Symbols（正文与卡片）

| 项 | 内容 |
| --- | --- |
| 来源 | [Material Symbols](https://fonts.google.com/icons)（Google 官方图标库，Rounded 风格） |
| 许可 | **Apache License 2.0** |
| 获取 | `https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@latest/rounded/<名称>.svg` |
| 处理 | `scripts/deck_mat_icons.mjs` 下载 SVG，注入语义色后由 sharp 渲染为 256×256 PNG（透明底、留白 12px） |
| 产物 | `docs/deck-assets/mat/*.png`（48 个） |
| 配色规则 | 医学类 `#0F7C8C` 墨青 · 技术类 `#1A6FB5` 主蓝 · 警示类 `#B42318` 红 |

用到的医学专用图标：`pulmonology`（肺）、`cardiology`（心电）、`bloodtype`（血糖）、
`genetics`（遗传）、`health_and_safety`（隐私盾）。

> 走过一条弯路：先用了 Twemoji（emoji 彩色图标），但卡通脸与这套医学/工程调性冲突、
> 语义也不准（病历用了家庭合照 emoji），已整体换成 Material Symbols，Twemoji 素材与脚本已删除。

## 2. 品牌官方图标（技术栈与部署图）

| 项 | 内容 |
| --- | --- |
| 来源 | [simple-icons](https://simpleicons.org/)（各品牌官方矢量路径） |
| 许可 | 图标数据 **CC0 1.0**；品牌商标归各自所有者，仅用于标识技术栈 |
| 处理 | `scripts/deck_brand_icons.mjs` 用 sharp 渲染，按各品牌官方色着色 |
| 产物 | `docs/deck-assets/brand/*.png`（14 个：Next.js / React / TypeScript / Node.js / MySQL / NVIDIA / Python / Docker / Git / Linux / Hugging Face / PyTorch / pnpm / Vitest） |

> llama.cpp 与 Qwen 没有官方品牌图标，**没有伪造**，这两处使用 Material Symbols 的通用图标。

## 3. 自绘图形（无外部来源）

| 项 | 内容 |
| --- | --- |
| 生成脚本 | `scripts/deck_art2.py`（六套栏目背景、中性背景、笔记本与浏览器外框、封面刊头）、`scripts/deck_art.py`（三代家系示意图） |
| 许可 | 随本项目 |
| 产物 | `docs/deck-assets/*.jpg`、`docs/deck-assets/pedigree-scene.png` |

（`docs/deck-assets/icons/` 里还留有早期自绘的双色线性图标，作为 Material 缺图标时的兜底。）

## 4. 产品截图

`docs/screenshots/*.png` —— 由本项目站点实际运行界面截取，套上程序生成的设备外框后使用。

## 复现

```bash
node scripts/deck_mat_icons.mjs     # Material 图标（需要联网）
node scripts/deck_brand_icons.mjs   # 品牌图标（需要联网）
python scripts/deck_art.py          # 家系示意图
python scripts/deck_art2.py         # 背景与设备外框
python scripts/build_deck_v2.py     # 生成 PPT
```
