# -*- coding: utf-8 -*-
"""生成答辩 PPT 的视觉素材（全部程序绘制，无外部素材与版权问题）。

  cover-bg.png        封面全幅背景：深蓝渐变 + 家系网络纹样（纹样就是产品对象本身）
  content-bg.png      内页浅色背景：低对比度，保证正文可读
  pedigree-scene.png  三代家系示意图（P3 用，透明底）

家系图按临床规范画：男=方、女=圆、婚配=横线、子女从婚配线中点垂下、斜线=已故。
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "deck-assets")
os.makedirs(OUT, exist_ok=True)
W, H = 2560, 1440

# 中文字体（没有它，标签会变成一排方块）
FONT_PATHS = ["C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/msyhl.ttc",
              "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/simsun.ttc"]


def load_font(size):
    for p in FONT_PATHS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, stops):
    w, h = size
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            p0, c0 = stops[i]
            p1, c1 = stops[i + 1]
            if p0 <= t <= p1:
                k = (t - p0) / (p1 - p0) if p1 > p0 else 0
                px[0, y] = lerp(c0, c1, k)
                break
    return img.resize(size, Image.BILINEAR)


def soft_blobs(img, specs):
    w, h = img.size
    base = img.convert("RGBA")
    for cx, cy, r, color, alpha in specs:
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        steps = 28
        for i in range(steps, 0, -1):
            k = i / steps
            rr = r * k
            a = int(alpha * (1 - k) ** 1.8)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color + (a,))
        layer = layer.filter(ImageFilter.GaussianBlur(r * 0.12))
        base = Image.alpha_composite(base, layer)
    return base


def pedigree_wire(img, color=(255, 255, 255), alpha=24, scale=1.0, offset=(0, 0), seed=11):
    """把家系拓扑（婚配横线 + 子女垂线）画成淡纹样，作为背景肌理。"""
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    ox, oy = offset
    lw = max(2, int(2 * scale))
    a = alpha

    def P(x, y):
        return (ox + x * w * scale, oy + y * h * scale)

    couples = [((0.10, 0.22), (0.20, 0.22)), ((0.42, 0.12), (0.52, 0.12)),
               ((0.62, 0.60), (0.72, 0.60)), ((0.22, 0.70), (0.32, 0.70))]
    for (a1, a2) in couples:
        p1, p2 = P(*a1), P(*a2)
        d.line([p1, p2], fill=color + (a,), width=lw)
        midx = (p1[0] + p2[0]) / 2
        drop = (midx, p2[1] + h * 0.10 * scale)
        d.line([(midx, p1[1]), drop], fill=color + (a,), width=lw)
        kids = rnd.choice([1, 2])
        for k in range(kids):
            kx = midx + (k - (kids - 1) / 2) * w * 0.07 * scale
            d.line([drop, (kx, drop[1] + h * 0.09 * scale)], fill=color + (a,), width=lw)
            r = 9 * scale
            d.ellipse([kx - r, drop[1] + h * 0.09 * scale - r, kx + r, drop[1] + h * 0.09 * scale + r],
                      outline=color + (int(a * 1.5),), width=lw)
        for p in (p1, p2):
            r = 10 * scale
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], outline=color + (int(a * 1.5),), width=lw)

    layer = layer.filter(ImageFilter.GaussianBlur(1.2 * scale))
    return Image.alpha_composite(img.convert("RGBA"), layer)


# ---------- 封面背景 ----------
cover = gradient((W, H), [(0.0, (5, 22, 40)), (0.40, (10, 42, 78)),
                          (0.74, (19, 72, 122)), (1.0, (7, 28, 50))])
cover = soft_blobs(cover, [(W * 0.80, H * 0.16, W * 0.44, (66, 148, 220), 70),
                           (W * 0.10, H * 0.88, W * 0.36, (24, 104, 172), 62),
                           (W * 0.50, H * 0.50, W * 0.34, (10, 56, 98), 46)])
cover = pedigree_wire(cover, alpha=26, scale=1.25, offset=(-W * 0.04, -H * 0.05))
cover = pedigree_wire(cover, alpha=16, scale=0.85, offset=(W * 0.42, H * 0.10), seed=41)
cover.convert("RGB").save(os.path.join(OUT, "cover-bg.png"), optimize=True)

# ---------- 内页背景 ----------
content = gradient((W, H), [(0.0, (245, 249, 253)), (0.5, (239, 246, 252)), (1.0, (232, 241, 250))])
content = soft_blobs(content, [(W * 0.94, H * 0.04, W * 0.30, (203, 224, 243), 95),
                               (W * 0.02, H * 0.98, W * 0.26, (211, 230, 246), 75)])
content = pedigree_wire(content, color=(122, 166, 206), alpha=12, scale=1.0,
                        offset=(W * 0.03, H * 0.05))
content.convert("RGB").save(os.path.join(OUT, "content-bg.png"), optimize=True)

# ---------- 三代家系示意图 ----------
SW, SH = 1240, 720
scene = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
d = ImageDraw.Draw(scene)
INK = (15, 42, 68)
PRIMARY = (26, 111, 181)
MUTED = (150, 173, 195)
BAD = (180, 35, 24)
f_small = load_font(19)
f_tiny = load_font(17)

LW = 4
R = 30


def node(x, y, male, affected=False, dead=False, big=False):
    r = R + (4 if big else 0)
    fill = PRIMARY if affected else (255, 255, 255)
    outline = PRIMARY if affected else MUTED
    if male:
        d.rectangle([x - r, y - r, x + r, y + r], fill=fill, outline=outline, width=LW)
    else:
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill, outline=outline, width=LW)
    if dead:
        d.line([x - r - 6, y + r + 6, x + r + 6, y - r - 6], fill=BAD, width=3)


def label(x, y, text, color=INK, font=None):
    f = font or f_tiny
    tw = d.textlength(text, font=f)
    d.text((x - tw / 2, y), text, fill=color, font=f)


def hline(x1, x2, y, color=MUTED):
    d.line([(x1, y), (x2, y)], fill=color, width=LW)


def vline(x, y1, y2, color=MUTED):
    d.line([(x, y1), (x, y2)], fill=color, width=LW)


# 坐标
pgf, pgm = (250, 150), (390, 150)
mgf, mgm = (730, 150), (870, 150)
p_uncle, pa = (250, 330), (390, 330)
ma, m_aunt = (730, 330), (870, 330)
me = (560, 520)

# 祖辈婚配 + 子女
hline(pgf[0], pgm[0], pgf[1])
vline((pgf[0] + pgm[0]) / 2, pgf[1], 250)
hline(p_uncle[0], pa[0], 250)
vline(p_uncle[0], 250, p_uncle[1] - R)
vline(pa[0], 250, pa[1] - R)

hline(mgf[0], mgm[0], mgf[1])
vline((mgf[0] + mgm[0]) / 2, mgf[1], 250)
hline(ma[0], m_aunt[0], 250)
vline(ma[0], 250, ma[1] - R)
vline(m_aunt[0], 250, m_aunt[1] - R)

# 父母婚配 + 本人
vline(pa[0], pa[1] + R, 400)
vline(ma[0], ma[1] + R, 400)
hline(pa[0], ma[0], 400)
vline((pa[0] + ma[0]) / 2, 400, me[1] - R - 4)

node(*pgf, True, affected=True)
node(*pgm, False)
node(*mgf, True, affected=True, dead=True)
node(*mgm, False)
node(*p_uncle, True)
node(*pa, True, affected=True)
node(*ma, False)
node(*m_aunt, False)
node(*me, True, big=True)

label(pgf[0], pgf[1] + R + 10, "爷爷 · 糖尿病")
label(pgm[0], pgm[1] + R + 10, "奶奶")
label(mgf[0], mgf[1] + R + 10, "外公 · 脑溢血")
label(mgm[0], mgm[1] + R + 10, "外婆")
# 第二代标签放到婚配线下方，否则会和横线压在一起
label(p_uncle[0], p_uncle[1] + R + 10, "叔")
label(pa[0], pa[1] + R + 34, "父亲 · 52 岁支架", PRIMARY, f_small)
label(ma[0], ma[1] + R + 34, "母亲")
label(m_aunt[0], m_aunt[1] + R + 10, "姨")
label(me[0], me[1] + R + 14, "本人", INK, f_small)

scene.save(os.path.join(OUT, "pedigree-scene.png"))
print("素材已生成 ->", OUT)
for f in sorted(os.listdir(OUT)):
    print("  ", f, round(os.path.getsize(os.path.join(OUT, f)) / 1024), "KB")
