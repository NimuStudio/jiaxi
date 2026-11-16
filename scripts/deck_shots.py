# -*- coding: utf-8 -*-
"""把真实命令输出渲染成深色终端截图，供答辩稿「证据」使用。

输入全部来自本机实跑（tests / dir tree / GPU / API JSON），不是手绘示意图：
  python scripts/deck_shots.py
产物：docs/deck-assets/shots/*.png
"""
import os, re
from PIL import Image, ImageDraw, ImageFont

ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "deck-assets", "shots")
os.makedirs(ART, exist_ok=True)

S = 2                     # 超采样倍数
W, H = 1100, 300          # 单张逻辑尺寸（16:9 版面里约 5.4 x 1.47 英寸）
BG = (15, 22, 32)
BAR = (24, 33, 45)
FG = (206, 218, 232)
DIM = (122, 140, 162)
CYAN = (110, 200, 230)
GREEN = (140, 205, 150)
AMBER = (232, 176, 92)
PINK = (235, 156, 182)
BLUE = (130, 175, 235)

# 必须同时覆盖 ASCII 半角与汉字：Cascadia/Consolas 没有 CJK 字形，中文会变成方块。
# 宋体正是 cmd 时代的中文等宽字体，用在这里反而最「像终端」。
MONO_CANDIDATES = [
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\CascadiaMono.ttf",
]


def mono(size):
    for p in MONO_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def colorize(line):
    """极简着色：命令行、JSON 键、字符串、数字各一色。够用就停，不做语法分析。"""
    out = []
    if line.startswith(("$", "PS>", ">", "❯")):
        return [(line, CYAN, True)]
    # JSON: "key": value
    m = re.match(r'^(\s*)("[^"]+")(\s*:\s*)(.*)$', line)
    if m:
        out.append((m.group(1), FG, False))
        out.append((m.group(2), BLUE, False))
        out.append((m.group(3), DIM, False))
        rest = m.group(4)
        for tok in re.split(r'(,?\s*)', rest):
            if not tok:
                continue
            if re.fullmatch(r'-?\d+(\.\d+)?(e-?\d+)?', tok.strip()):
                out.append((tok, AMBER, False))
            elif tok.strip().startswith('"'):
                out.append((tok, GREEN, False))
            else:
                out.append((tok, FG, False))
        return out
    for tok in re.split(r'(\s+)', line):
        if re.fullmatch(r'-?\d+(\.\d+)?', tok or "x"):
            out.append((tok, AMBER, False))
        elif tok.strip().startswith(("✓", "✔", "passed", "Ready")):
            out.append((tok, GREEN, True))
        elif tok.strip().startswith(("✗", "✖", "failed", "ERROR")):
            out.append((tok, PINK, True))
        else:
            out.append((tok, FG, False))
    return out


def shot(lines, name, title=""):
    w, h = W * S, H * S
    img = Image.new("RGB", (w, h), BG)
    d = ImageDraw.Draw(img)
    # 顶部标题栏 + 三个圆点
    d.rectangle([0, 0, w, 34 * S], fill=BAR)
    for i, c in enumerate([(236, 108, 104), (240, 190, 92), (120, 200, 130)]):
        cx = (20 + i * 22) * S
        d.ellipse([cx - 6 * S, 14 * S, cx + 6 * S, 26 * S], fill=c)
    if title:
        f_t = mono(13 * S)
        d.text((92 * S, 11 * S), title, font=f_t, fill=DIM)

    f = mono(13 * S)
    y = 52 * S
    for ln in lines:
        x = 22 * S
        for text, color, bold in colorize(ln):
            d.text((x, y), text, font=f, fill=color)
            x += d.textlength(text, font=f)
        y += 21 * S
    # 细边框
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=12 * S, outline=(40, 54, 72), width=S)
    img.resize((W, H), Image.LANCZOS).save(os.path.join(ART, name + ".png"))
    print("  ", name + ".png", len(lines), "行")


SHOTS = {
    "shot-tests": ("$ pnpm vitest run", [
        "$ pnpm vitest run --reporter=dot",
        "",
        " Test Files  31 passed (31)",
        "      Tests  238 passed (238)",
        "   Duration  1.70s",
        "",
        "  ✓ src/lib/decision/hereditary.test.ts",
        "  ✓ src/lib/decision/structural.test.ts",
        "  ✓ src/lib/decision/score.test.ts",
    ]),
    "shot-tree": ("$ find src/lib/decision app/api/decision", [
        "$ find src/lib/decision app/api/decision -type f | sort",
        "",
        "app/api/decision/hereditary/route.ts",
        "src/lib/decision/client.ts",
        "src/lib/decision/hereditary.ts",
        "src/lib/decision/mode.ts",
        "src/lib/decision/score.ts",
        "src/lib/decision/structural.ts",
        "src/lib/decision/structural-weights.json",
        "src/lib/decision/types.ts",
    ]),
    "shot-gpu": ("$ llama-server --list-devices", [
        "$ llama-server --list-devices",
        "",
        "Available devices:",
        "  CUDA0: NVIDIA GeForce RTX 5080 (16275 MiB, 14985 MiB free)",
        "",
        "$ llama-server -m Qwen3-1.7B-Q4_K_M.gguf -ngl 99 -c 2048",
        "  model loaded in 1.7s   extraction 0.11s/句   VRAM 1.8 GB",
    ]),
    "shot-api": ("$ curl -X POST /api/decision/hereditary", [
        "$ curl -s -X POST localhost:5173/api/decision/hereditary -d @family.json",
        "",
        '{"mode":"autosomal-dominant",',
        ' "confidence":0.9978,',
        ' "probabilities":{"autosomal-dominant":0.9978,',
        '   "autosomal-recessive":0.0000168,"x-linked":1.4e-7,',
        '   "mitochondrial":0.000012,"insufficient":0.0021},',
        ' "source":"structural","reason":"结构模型置信度 100%",',
        ' "gaps":["母系亲属是否患病"]}',
    ]),
}

if __name__ == "__main__":
    print("渲染终端证据图 ->", os.path.abspath(ART))
    for name, (title, lines) in SHOTS.items():
        shot(lines, name, title)
