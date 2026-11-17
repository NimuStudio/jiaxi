# 演示视频（Remotion）

用代码生成视频里的动画段。改一行文案、改一个数字，重渲染一次就出片——不需要重录。

## 为什么用 Remotion

演示视频里有两种内容，制作方式应该不同：

| 内容 | 做法 | 理由 |
|---|---|---|
| 真实的对话交互、界面操作 | **屏幕录制** | 评分表要求看到 AI 在真跑，动画会被当成 PPT |
| 开场、技术链路、风险尺收缩、收尾 | **Remotion** | 确定性、可重渲染；录屏做不出稳定的运镜与节奏，改文案还得重录 |

四段动画合计 **2 分 50 秒**，与约 4 分 10 秒的录屏一起剪成 7 分 15 秒。
完整的成片结构见 `../docs/demo-script.md`。

## 配乐（CC BY 4.0）

用 4 首曲库短曲拼成音乐床（`scripts/build_bed.py`），比单曲循环更耐听：

| 曲目 | 来源 |
|---|---|
| Funkorama / Funk Game Loop / Disco Medusae / Wallpaper | Kevin MacLeod (incompetech.com)，CC BY 4.0 |

**署名是许可条件**：成片末尾有 3 秒署名卡（`src/film/Credits.tsx`）。
把这四首换掉时，记得同步改署名卡，否则违反 CC BY。

下载（素材不入 git，需要时重下）：

```bash
mkdir -p ref && cd ref
for n in Funkorama "Funk Game Loop" "Disco Medusae" "Wallpaper"; do
  curl -L -o "${n// /_}.mp3" "https://incompetech.com/music/royalty-free/mp3-royaltyfree/${n// /%20}.mp3"
done
```

## 成片（配音驱动）

```bash
python scripts/tts.py          # 逐句合成配音 → public/audio/*.mp3 + src/timing.json
python scripts/storyboard.py   # timing.json → script.md（分镜表）
python scripts/music.py        # 合成 168s 配乐（无版权，纯数学生成）
npx remotion render src/index.ts Film out/0-film.mp4 --codec=h264 --crf=19
npx remotion still  src/index.ts Cover out/cover.png
```

时间轴全部来自真实配音时长：改一句文案 → 重跑 `tts.py` + `storyboard.py` → 时长自动重算。
当前成片：**165.5 秒 / 1920×1080 / h264+aac**，七个章节（见 `script.md`）。

## 四段动画（旧，保留备用）

| Composition | 时长 | 内容 |
|---|---|---|
| `Opening` | 38s | 冷开场：一句家族史 → 家系图逐个长出 → 片名 |
| `Pipeline` | 62.5s | AI 链路：输入 → 分句 → 约束解码 → 词表校正 → 证据校验 |
| `RiskDrop` | 50s | 可回收风险：33% → 17% → 4%，橙色段被逐段吃掉 |
| `Outro` | 20s | 收尾：三样交付物 + 「使用者与受益者是两个人」 |

## 用法

```bash
pnpm install
npx remotion studio          # 预览，可逐帧拖时间轴

npx remotion render src/index.ts Opening  out/1-opening.mp4  --codec=h264 --crf=18
npx remotion render src/index.ts Pipeline out/2-pipeline.mp4 --codec=h264 --crf=18
npx remotion render src/index.ts RiskDrop out/3-riskdrop.mp4 --codec=h264 --crf=18
npx remotion render src/index.ts Outro    out/4-outro.mp4    --codec=h264 --crf=18
```

1920×1080 / 30fps。单帧调试：

```bash
npx remotion still src/index.ts RiskDrop out/frame.png --frame=1260
```

## 两个环境相关的点

**一、浏览器用系统 Edge，不是 Remotion 自带的 Chrome。**

这台机器访问不到 `storage.googleapis.com`，Remotion 下载不了 Chrome Headless Shell。
`remotion.config.ts` 里通过 `Config.setBrowserExecutable()` 指向本机 Edge（同为 Chromium 内核）。
换机器时改这一行，或用环境变量 `REMOTION_BROWSER` 覆盖。

**二、npm 走国内镜像。**

`video/.npmrc` 里写了 `registry=https://registry.npmmirror.com`，
因为 `registry.npmjs.org` 在这里单次请求要 15 秒以上。

## 数字从哪来

**画面里出现的每个数字都不是手写的**，而是与代码同源：

| 画面 | 来源 |
|---|---|
| 33% / 17% / 4%、7 分、16 分、9 分 | `../src/lib/risk/findrisc.ts` 的实际输出 |
| 分档边界（0–6 / 7–11 / 12–14 / 15–20 / 21–26） | 同上，与产品完全一致 |
| F1 0.952、Precision 1.000、23 个单测 | 评测脚本的实际结果 |

所以改了分档阈值或风险值，重渲染一次画面就跟着变，
不会出现「视频说 33%、产品说 17%」这种答辩现场最致命的错误。

`RiskDrop` 里的 `riskOfScore()` 是 `findrisc.ts` 中 `bandOf()` + 分档风险表的复刻，
改阈值时**两处都要改**——这一点在文件顶部注释里也标注了。

## 目录

```
video/
├─ src/
│  ├─ theme.ts              颜色/字号/帧率，取自 app/globals.css
│  ├─ index.ts              入口
│  ├─ Root.tsx              四个 Composition 注册
│  ├─ components/Frame.tsx  统一背景与品牌标识
│  └─ scenes/
│     ├─ Opening.tsx
│     ├─ Pipeline.tsx
│     ├─ RiskDrop.tsx
│     └─ Outro.tsx
├─ remotion.config.ts       浏览器路径、并发数、输出覆盖
└─ .npmrc                   国内镜像
```
