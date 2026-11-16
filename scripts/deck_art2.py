# -*- coding: utf-8 -*-
"""PPT 背景与设备外框（第二版：多元素分层）。

内页背景由这些层叠出来，全部低透明度、集中放在四角，中间留给正文：
  1) 竖向浅渐变
  2) 两处色雾（该栏目色相）
  3) 点阵网格（技术稿纸感）
  4) 右上同心弧（三层）
  5) 右上大号栏目数字（01-06，被右边缘裁切）
  6) 左下栏目专属图形（家系树 / 流程块 / 节点网 / 靶环 / 上升柱 / 三人）
  7) 细噪点 + 四角暗角（让平涂变有质感）

封面另有：描边大字 PEDIGREE + 更强的色雾与节点网。
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "docs", "deck-assets")
SHOTS = os.path.join(ROOT, "docs", "screenshots")
os.makedirs(ART, exist_ok=True)
# 2000x1125 足够（投影与打印都过 150dpi），配合 JPEG 输出把体积压下来：
# 噪点纹理让 PNG 完全压不动，第一版 6 张背景做出 34MB 的 PPT。
W, H = 2000, 1125
JPEG_Q = 86

FONTS = ["C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/msyhbd.ttc",
         "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/simsun.ttc"]
BOLD = ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/simhei.ttf"]
LATIN_BOLD = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/seguisb.ttf"]


def font_of(paths, size):
    for p in paths:
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
    return img.resize(size, Image.BILINEAR).convert("RGBA")


def overlay(img, layer):
    return Image.alpha_composite(img, layer)


def soft_blob(img, cx, cy, r, color, alpha):
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i in range(26, 0, -1):
        k = i / 26
        rr = r * k
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color + (int(alpha * (1 - k) ** 1.8),))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.12))
    return overlay(img, layer)


def dot_grid(img, color, alpha=26, pitch=34, radius=2.6):
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for y in range(pitch // 2, h, pitch):
        for x in range(pitch // 2, w, pitch):
            d.ellipse([x - radius, y - radius, x + radius, y + radius], fill=color + (alpha,))
    return overlay(img, layer)


def arcs(img, cx, cy, radii, color, alpha=34, width=3):
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r in radii:
        d.arc([cx - r, cy - r, cx + r, cy + r], start=150, end=330, fill=color + (alpha,), width=width)
    layer = layer.filter(ImageFilter.GaussianBlur(0.8))
    return overlay(img, layer)


def big_numeral(img, text, color, alpha=16, size=760, cx=1.02, cy=0.30):
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font_of(LATIN_BOLD, size)
    tw = d.textlength(text, font=f)
    d.text((cx * w - tw / 2, cy * h - size * 0.72), text, font=f, fill=color + (alpha,))
    return overlay(img, layer)


def grain(img, amount=4.2):
    w, h = img.size
    noise = np.random.normal(0, amount, (h, w, 1)).repeat(3, axis=2)
    arr = np.clip(np.asarray(img.convert("RGB"), dtype=np.float32) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB").convert("RGBA")


def color_panel(img, color, alpha=255, side="left", width_frac=0.30, light=0.86, span=(0.0, 1.0)):
    """一侧实色面板：把栏目色与白混合后铺成不透明的一块，正文压在它上面仍然可读。

    「不透明」是为了让版面有真正的色块重量——半透明色雾做不出这种边界感。
    """
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    tint = tuple(int(c + (255 - c) * light) for c in color)
    pw = int(w * width_frac)
    y0, y1 = int(h * span[0]), int(h * span[1])
    box = [0, y0, pw, y1] if side == "left" else [w - pw, y0, w, y1]
    d.rectangle(box, fill=tint + (alpha,))
    # 内缘一道更深的细线，收住边界（不加就会像没对齐的色块）
    edge_x = pw - 2 if side == "left" else w - pw
    d.rectangle([edge_x, y0, edge_x + 2, y1], fill=color + (int(alpha * 0.22),))
    return overlay(img, layer)


def giant_text(img, text, color, alpha=30, size=330, x=-0.06, y=0.52):
    """整页背景级别的巨型字：章节名放到 300px+，一半被页面裁掉。

    这种「字的重量」是版面上最省成本、也最有效果的设计手段：
    远看是一块灰，近看是章节名，尺度感立刻不一样。
    """
    w, h = img.size
    f = font_of(BOLD, size)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, ch in enumerate(text):
        d.text((w * x, h * y + i * size * 1.02), ch, font=f, fill=color + (alpha,))
    return overlay(img, layer)


def duotone_texture(img, src_png, color, alpha=26, blur=1.6, crop=(0, 0, 1, 1), light=210):
    """把真实图片（家系图/截图）做成双色调底纹：去色 → 染栏目色 → 压到很淡。

    和矢量线条的区别在于它带「材料的细节」：文字、圆角、像素灰阶都还在，
    只是被压成一层纸纹。
    """
    if not os.path.exists(src_png):
        return img
    src = Image.open(src_png).convert("L")
    w, h = src.size
    box = (int(w * crop[0]), int(h * crop[1]), int(w * crop[2]), int(h * crop[3]))
    src = src.crop(box).resize(img.size, Image.LANCZOS)
    src = src.filter(ImageFilter.GaussianBlur(blur))
    # 亮部→近白，暗部→栏目色
    tint = Image.new("RGB", img.size, color)
    white = Image.new("RGB", img.size, (255, 255, 255))
    base = Image.composite(white, tint, src)          # 原图亮的地方放白
    layer = base.convert("RGBA")
    layer.putalpha(int(alpha))
    return overlay(img, layer)


def mass_circle(img, color, alpha=40, cx=0.92, cy=0.9, r=0.62, blur=3):
    """一大块实色圆：背景需要「重量」，一层层淡线撑不起版面。

    alpha 指的是最终色块强度（0-255），配合 blur 让边缘不出现锯齿带。
    """
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rr = min(w, h) * r
    d.ellipse([w * cx - rr, h * cy - rr, w * cx + rr, h * cy + rr], fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return overlay(img, layer)


def mass_band(img, color, alpha=34, flip=False, cover=0.52, blur=4):
    """一条斜向大色带：把版面切成两块，正文压在浅的一侧。"""
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if flip:
        pts = [(0, h * (1 - cover)), (w, h * (1 - cover * 1.6)), (w, h), (0, h)]
    else:
        pts = [(0, 0), (w, 0), (w, h * cover * 0.9), (0, h * cover * 1.35)]
    d.polygon(pts, fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return overlay(img, layer)


def halftone(img, color, peak=90, cx=0.95, cy=0.05, pitch=15, rmax=6.4):
    """网点渐层：靠「点的大小」做渐变，像印刷品的半调。

    这是少数既有重量、又不抢字的纹理——远看是一块色，近看是一堆点。
    """
    import math
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ox, oy = w * cx, h * cy
    maxd = math.hypot(w, h) * 0.62
    for y in range(0, h + pitch, pitch):
        for x in range(0, w + pitch, pitch):
            dist = math.hypot(x - ox, y - oy) / maxd
            if dist >= 1:
                continue
            k = (1 - dist) ** 2.1            # 越靠近焦点越大
            r = rmax * k
            if r < 0.7:
                continue
            a = int(peak * k)
            d.ellipse([x - r, y - r, x + r, y + r], fill=color + (max(4, a),))
    return overlay(img, layer)


def corner_wedge(img, color, alpha=30, corner="tr", size=0.42):
    """角落扇形：从页面角上切一道弧，制造对角线方向的张力。"""
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = max(w, h) * size
    if corner == "tr":
        box = [w - r, -r, w + r, r]
    elif corner == "bl":
        box = [-r, h - r, r, h + r]
    else:
        box = [w - r, h - r, w + r, h + r]
    d.ellipse(box, fill=color + (alpha,))
    layer = layer.filter(ImageFilter.GaussianBlur(2))
    return overlay(img, layer)


def contour_field(img, color, alpha=26, cx=0.86, cy=0.1, rings=26, seed=7, step=52):
    """等高线场：一圈圈被正弦扰动的闭合曲线。

    比圆弧「有内容」——它是地形图/拓扑图的语言，和家系、谱系天然同源；
    透明度压到 3%-8%，退到背景里只提供纹理与方向感，不抢正文。
    """
    import math, random
    rnd = random.Random(seed)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w, h = img.size
    ox, oy = w * cx, h * cy
    for i in range(rings):
        r0 = 90 + i * step
        k1, k2 = rnd.uniform(0.028, 0.062), rnd.uniform(0.012, 0.03)
        p1, p2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
        pts = []
        for deg in range(0, 360, 4):
            t = math.radians(deg)
            rr = r0 * (1 + k1 * math.sin(3 * t + p1) + k2 * math.sin(7 * t + p2))
            pts.append((ox + rr * math.cos(t) * 1.35, oy + rr * math.sin(t)))
        pts.append(pts[0])
        a = max(6, int(alpha * (1 - i / (rings + 6))))
        d.line(pts, fill=color + (a,), width=2, joint="curve")
    return overlay(img, layer)


def vertical_text(img, text, color, alpha=18, size=150, x=0.94, y=0.07):
    """右缘竖排章节名：逐字竖排（不旋转），右半截被页面边缘裁掉。

    比「01 / 02」数字水印更像编辑设计——数字只是编号，汉字是内容本身。
    注意：CJK 的竖排是「字往下排」，不是把横排文字整体转 90°（那样会变成横躺）。
    """
    w, h = img.size
    f = font_of(BOLD, size)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    px, py = int(w * x), int(h * y)
    for i, ch in enumerate(text):
        d.text((px, py + i * size * 1.06), ch, font=f, fill=color + (alpha,))
    return overlay(img, layer)


def reg_marks(img, color, alpha=34, inset=34, arm=26):
    """制图角标：四角的十字与上下标尺刻度，像图纸的定位标记。"""
    w, h = img.size
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (x, y) in [(inset, inset), (w - inset, inset), (inset, h - inset), (w - inset, h - inset)]:
        d.line([(x - arm, y), (x + arm, y)], fill=color + (alpha,), width=2)
        d.line([(x, y - arm), (x, y + arm)], fill=color + (alpha,), width=2)
    # 上下标尺：每 40px 一个短刻度，每 5 个一根长刻度
    for i, x in enumerate(range(inset + 90, w - inset - 90, 40)):
        ln = 14 if i % 5 else 24
        d.line([(x, inset - 6), (x, inset - 6 + ln)], fill=color + (max(10, alpha - 12),), width=1)
        d.line([(x, h - inset + 6), (x, h - inset + 6 - ln)], fill=color + (max(10, alpha - 12),), width=1)
    return overlay(img, layer)


def vignette(img, alpha=26):
    w, h = img.size
    mask = Image.radial_gradient("L").resize((w, h), Image.BILINEAR)
    mask = Image.eval(mask, lambda v: max(0, int((v - 90) * alpha / 165)))
    dark = Image.new("RGBA", (w, h), (12, 36, 62, 255))
    dark.putalpha(mask)
    return overlay(img, dark)


def pedestal_wire(img, color, alpha=13, scale=1.0, offset=(0, 0), seed=11):
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    ox, oy = offset
    lw = max(2, int(2.4 * scale))
    couples = [((0.10, 0.22), (0.20, 0.22)), ((0.42, 0.12), (0.52, 0.12)),
               ((0.62, 0.60), (0.72, 0.60)), ((0.22, 0.70), (0.32, 0.70))]
    for a1, a2 in couples:
        p1 = (ox + a1[0] * w * scale, oy + a1[1] * h * scale)
        p2 = (ox + a2[0] * w * scale, oy + a2[1] * h * scale)
        d.line([p1, p2], fill=color + (alpha,), width=lw)
        midx = (p1[0] + p2[0]) / 2
        drop = (midx, p2[1] + h * 0.10 * scale)
        d.line([(midx, p1[1]), drop], fill=color + (alpha,), width=lw)
        for k in range(rnd.choice([1, 2])):
            kx = midx + (k - 0.5) * w * 0.07 * scale
            ty = drop[1] + h * 0.09 * scale
            d.line([drop, (kx, ty)], fill=color + (alpha,), width=lw)
            r = 10 * scale
            d.ellipse([kx - r, ty - r, kx + r, ty + r], outline=color + (int(alpha * 1.6),), width=lw)
        for p in (p1, p2):
            r = 11 * scale
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], outline=color + (int(alpha * 1.6),), width=lw)
    return overlay(img, layer.filter(ImageFilter.GaussianBlur(1.0 * scale)))


# ---------- 六个栏目各自的角标图形 ----------
def motif_flow(img, color, x, y, s=1.0, alpha=30):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bw, bh, gap = 210 * s, 96 * s, 54 * s
    for i in range(4):
        bx = x + i * (bw + gap)
        d.rounded_rectangle([bx, y, bx + bw, y + bh], radius=22 * s,
                            outline=color + (alpha,), width=int(3 * s))
        if i < 3:
            d.line([bx + bw + 12 * s, y + bh / 2, bx + bw + gap - 12 * s, y + bh / 2],
                   fill=color + (alpha,), width=int(3 * s))
    return overlay(img, layer)


def motif_graph(img, color, x, y, s=1.0, alpha=30):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(5)
    pts = [(x + rnd.uniform(0, 520) * s, y + rnd.uniform(0, 300) * s) for _ in range(9)]
    for i, p in enumerate(pts):
        for q in pts[i + 1:]:
            if math.dist(p, q) < 240 * s:
                d.line([p, q], fill=color + (int(alpha * 0.6),), width=int(2 * s))
    for p in pts:
        r = 13 * s
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], outline=color + (alpha,), width=int(3 * s))
    return overlay(img, layer)


def motif_target(img, color, x, y, s=1.0, alpha=30):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r in (190 * s, 132 * s, 74 * s):
        d.ellipse([x - r, y - r, x + r, y + r], outline=color + (alpha,), width=int(3 * s))
    d.ellipse([x - 16 * s, y - 16 * s, x + 16 * s, y + 16 * s], fill=color + (int(alpha * 1.1),))
    return overlay(img, layer)


def motif_bars(img, color, x, y, s=1.0, alpha=30):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    hs = [0.34, 0.5, 0.44, 0.7, 0.92]
    for i, hh in enumerate(hs):
        bx = x + i * 96 * s
        d.rounded_rectangle([bx, y + 300 * s - 300 * s * hh, bx + 62 * s, y + 300 * s],
                            radius=12 * s, outline=color + (alpha,), width=int(3 * s))
    d.line([x - 20 * s, y + 300 * s, x + 5 * 96 * s, y + 300 * s], fill=color + (alpha,), width=int(3 * s))
    return overlay(img, layer)


def motif_people(img, color, x, y, s=1.0, alpha=30):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, dx in enumerate((-150 * s, 0, 150 * s)):
        cx = x + dx
        r = 54 * s if i == 1 else 42 * s
        d.ellipse([cx - r, y - r, cx + r, y + r], outline=color + (alpha,), width=int(3 * s))
        d.arc([cx - 108 * s, y + 52 * s, cx + 108 * s, y + 268 * s], start=200, end=340,
              fill=color + (alpha,), width=int(3 * s))
    return overlay(img, layer)


# 六个栏目各给一个真正的色相：暖 → 青 → 蓝 → 紫 → 玫 → 绿。
# 原来六套都是蓝青紫的近亲，翻页时读起来「整本只有一个蓝色」。
SECTIONS = [
    ("项目背景", (176, 106, 8), (247, 232, 206), "01", "wire"),
    ("方案与产品", (13, 124, 138), (198, 231, 233), "02", "flow"),
    ("技术路线", (26, 111, 181), (198, 220, 241), "03", "graph"),
    ("准确性与选型", (104, 78, 186), (222, 213, 242), "04", "target"),
    ("价值与落地", (183, 68, 94), (246, 222, 226), "05", "bars"),
    ("团队", (58, 124, 101), (214, 236, 228), "06", "people"),
]

SEED_BASE = 11
for idx, (name, tone, wash, num, motif) in enumerate(SECTIONS):
    bg = gradient((W, H), [(0.0, (247, 250, 254)), (0.50, (241, 246, 252)), (1.0, (233, 241, 250))])
    # 整页先铺一层栏目色（不是只有四角有雾）：这是「页面有颜色」与「白纸」的分界
    bg = soft_blob(bg, W * 0.50, H * 0.46, W * 0.92, tone, 26)
    bg = soft_blob(bg, W * 0.98, H * 0.04, W * 0.42, wash, 165)
    bg = soft_blob(bg, W * 0.02, H * 1.02, W * 0.34, wash, 120)
    # 参考稿的背景是有存在感的纹理；纯白会显得像没设计过的文档。
    # 点阵加密到 28px、透明度 30→40；弧线同步提一档，但仍低于正文对比度。
    # —— 每章 = 实色面板（重量）+ 巨型章节名（尺度）+ 真实图片底纹（材料） ——
    # 三样都只在「有边界」的前提下才成立：面板给边界，字号给尺度，图片给细节。
    PANELS = ["left", "right", "left", "right", "left", "right"]
    TEXTURES = [
        (os.path.join(ART, "tree.png"), (0.02, 0.10, 0.78, 0.92)),          # 家系图
        (os.path.join(SHOTS, "02-chat.png"), (0.10, 0.05, 0.95, 0.85)),     # 梳理页
        (os.path.join(ART, "shots", "shot-tests.png"), (0, 0, 1, 1)),        # 终端
        (os.path.join(ART, "shots", "shot-browser-cvd.png"), (0.05, 0.05, 0.95, 0.9)),
        (os.path.join(SHOTS, "03-reclaim.png"), (0.0, 0.06, 0.9, 0.94)),
        (None, None),
    ]
    side = PANELS[idx]
    # 面板高度也轮换：通高 / 下半 / 上半 / 中段，翻页时轮廓不止左右之差
    SPANS = [(0.0, 1.0), (0.34, 1.0), (0.0, 1.0), (0.0, 0.64), (0.0, 1.0), (0.26, 0.8)]
    tex, crop = TEXTURES[idx]
    if tex:
        bg = duotone_texture(bg, tex, tone, alpha=26, blur=2.0, crop=crop)
    # 面板收窄到 0.18、白度 0.70：22% 时左侧标签整列压在色块上，灰字对比度不够
    bg = color_panel(bg, tone, side=side, width_frac=0.18, light=0.70, span=SPANS[idx])
    # 巨型章节名放在面板那一侧，压在上面形成「色块 + 大字」的封面感
    # 巨型字只露半截：全露出来会压住正文，露一半才是「版面上的字」而不是「水印」
    gx = -0.115 if side == "left" else 0.79
    bg = giant_text(bg, name, tone, alpha=40, size=320, x=gx, y=0.26)
    bg = dot_grid(bg, tone, alpha=22, pitch=32, radius=2.3)
    bg = reg_marks(bg, tone, alpha=40)

    if motif == "wire":
        bg = pedestal_wire(bg, tone, alpha=15, scale=1.05, offset=(W * 0.02, H * 0.02))
    elif motif == "flow":
        bg = motif_flow(bg, tone, W * 0.055, H * 0.80, s=1.15, alpha=34)
    elif motif == "graph":
        bg = motif_graph(bg, tone, W * 0.04, H * 0.66, s=1.25, alpha=34)
    elif motif == "target":
        bg = motif_target(bg, tone, W * 0.075, H * 0.86, s=1.1, alpha=34)
    elif motif == "bars":
        bg = motif_bars(bg, tone, W * 0.055, H * 0.72, s=1.1, alpha=34)
    elif motif == "people":
        bg = motif_people(bg, tone, W * 0.10, H * 0.84, s=1.15, alpha=34)

    bg = grain(bg, amount=4.0)
    bg = vignette(bg, alpha=30)
    bg.convert("RGB").save(os.path.join(ART, f"content-bg-{idx}.jpg"),
                           quality=JPEG_Q, optimize=True)
    print("  bg", idx, name, motif)

# ---------- 中性背景（过渡页：不带栏目数字与专属图形） ----------
plain = gradient((W, H), [(0.0, (247, 250, 254)), (0.50, (241, 246, 252)), (1.0, (233, 241, 250))])
plain = soft_blob(plain, W * 0.99, H * 0.03, W * 0.34, (203, 224, 243), 120)
plain = soft_blob(plain, W * 0.01, H * 1.0, W * 0.26, (206, 228, 246), 80)
plain = contour_field(plain, (26, 111, 181), alpha=22, cx=0.12, cy=0.92, rings=18, seed=97, step=62)
plain = dot_grid(plain, (26, 111, 181), alpha=24, pitch=34, radius=2.4)
plain = reg_marks(plain, (26, 111, 181), alpha=30)
plain = arcs(plain, W * 1.02, H * -0.02, [W * 0.30, W * 0.40, W * 0.50], (26, 111, 181), alpha=26, width=3)
plain = pedestal_wire(plain, (26, 111, 181), alpha=14, scale=1.05, offset=(W * 0.02, H * 0.04))
plain = grain(plain, amount=4.0)
plain = vignette(plain, alpha=28)
plain.convert("RGB").save(os.path.join(ART, "content-bg-plain.jpg"), quality=JPEG_Q, optimize=True)

# ---------- 目录页专用背景：右侧巨型「目录」+ 六道栏目色刻度 ----------
toc = gradient((W, H), [(0.0, (250, 252, 255)), (0.55, (243, 247, 253)), (1.0, (232, 240, 251))])
toc = soft_blob(toc, W * 0.02, H * 0.5, W * 0.5, (206, 226, 245), 150)
toc = duotone_texture(toc, os.path.join(ART, "tree.png"), (26, 111, 181), alpha=18, blur=2.4,
                      crop=(0.02, 0.10, 0.72, 0.9))
toc = giant_text(toc, "目录", (26, 111, 181), alpha=30, size=430, x=0.715, y=0.06)
toc = vertical_text(toc, "CONTENTS", (26, 111, 181), alpha=26, size=64, x=0.955, y=0.10)
# 六道栏目色刻度：目录页顺带当全篇的色卡
TICKS = [(176, 106, 8), (13, 124, 138), (26, 111, 181), (104, 78, 186), (183, 68, 94), (58, 124, 101)]
for i, c in enumerate(TICKS):
    ly = int(H * (0.20 + i * 0.115))
    t = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    d.rectangle([int(W * 0.905), ly, int(W * 0.905) + 26, ly + 10], fill=c + (200,))
    toc = overlay(toc, t)
toc = dot_grid(toc, (26, 111, 181), alpha=20, pitch=34, radius=2.3)
toc = reg_marks(toc, (26, 111, 181), alpha=34)
toc.convert("RGB").save(os.path.join(ART, "content-bg-toc.jpg"), quality=JPEG_Q, optimize=True)

# ---------- 引语页专用背景：暖调 + 家系图双色调 ----------
quo = gradient((W, H), [(0.0, (252, 250, 247)), (0.55, (248, 245, 240)), (1.0, (240, 236, 229))])
quo = soft_blob(quo, W * 0.12, H * 0.9, W * 0.5, (245, 220, 190), 150)
quo = soft_blob(quo, W * 0.95, H * 0.08, W * 0.42, (214, 226, 244), 120)
quo = duotone_texture(quo, os.path.join(ART, "tree.png"), (176, 106, 8), alpha=20, blur=2.6,
                      crop=(0.05, 0.05, 0.95, 0.85))
quo = contour_field(quo, (176, 106, 8), alpha=18, cx=0.05, cy=0.95, rings=16, seed=61, step=66)
quo = reg_marks(quo, (176, 106, 8), alpha=30)
quo.convert("RGB").save(os.path.join(ART, "content-bg-quote.jpg"), quality=JPEG_Q, optimize=True)
print("  content-bg-plain.jpg 已生成")

# ---------- 封面背景（更深、元素更多） ----------
cover = gradient((W, H), [(0.0, (4, 18, 34)), (0.38, (8, 36, 68)),
                          (0.72, (17, 66, 112)), (1.0, (6, 24, 44))])
cover = soft_blob(cover, W * 0.82, H * 0.14, W * 0.46, (66, 148, 220), 76)
cover = soft_blob(cover, W * 0.08, H * 0.92, W * 0.38, (24, 104, 172), 70)
cover = soft_blob(cover, W * 0.50, H * 0.55, W * 0.34, (8, 44, 78), 60)
cover = dot_grid(cover, (255, 255, 255), alpha=16, pitch=42, radius=2.2)
cover = arcs(cover, W * 1.05, H * -0.05, [W * 0.34, W * 0.44, W * 0.54, W * 0.64],
             (140, 200, 240), alpha=30, width=3)
cover = pedestal_wire(cover, (255, 255, 255), alpha=26, scale=1.25, offset=(-W * 0.04, -H * 0.05))
cover = pedestal_wire(cover, (255, 255, 255), alpha=15, scale=0.85, offset=(W * 0.44, H * 0.08), seed=41)
cover = motif_graph(cover, (150, 205, 240), W * 0.58, H * 0.62, s=1.15, alpha=26)
cover = grain(cover, amount=5.0)
cover = vignette(cover, alpha=42)


def bake_wordmark(img, text="PEDIGREE", size_px=352, tracking=0.14, stroke=3,
                  color=(255, 255, 255, 76), top=None):
    """把描边字烘进背景。top 给定时按该像素位置定位（可负、越界被裁），否则贴底。"""
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font_of(LATIN_BOLD, size_px)
    widths = [d.textlength(ch, font=f) for ch in text]
    gap = size_px * tracking
    total = sum(widths) + gap * (len(text) - 1)
    x = (w - total) / 2
    y = (h - size_px * 0.86) if top is None else top
    for ch, cw in zip(text, widths):
        d.text((x, y), ch, font=f, fill=(0, 0, 0, 0), stroke_width=stroke, stroke_fill=color)
        x += cw + gap
    return overlay(img, layer)


# 顶部刊头：巨型描边字，上缘被裁掉，只露下 45%（开场的第一记）
cover = bake_wordmark(cover, size_px=560, tracking=0.17, stroke=5,
                      color=(255, 255, 255, 86), top=-int(560 * 0.52))
cover.convert("RGB").save(os.path.join(ART, "cover-bg.jpg"), quality=JPEG_Q + 2, optimize=True)
print("  cover-bg.jpg 已更新")

# ---------- 设备 / 浏览器外框（与上一版一致） ----------
def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def shadow_of(size, radius, blur=26, alpha=70, dy=14):
    w, h = size
    pad = blur * 3
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([pad, pad + dy, pad + w, pad + h + dy], radius=radius, fill=(16, 42, 68, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(canvas, layer), pad


def laptop_frame(shot_png, out_png):
    shot = Image.open(shot_png).convert("RGB")
    sw, sh = 1600, 1000
    shot = shot.resize((sw, sh), Image.LANCZOS)
    bezel = 22
    screen_w, screen_h = sw + bezel * 2, sh + bezel * 2
    lid_w, lid_h = screen_w + 22, screen_h + 22
    base_h = 34
    pad = 60
    canvas = Image.new("RGBA", (lid_w + pad * 2, lid_h + base_h + pad * 2), (0, 0, 0, 0))
    sh_img, sp = shadow_of((lid_w, lid_h + base_h), 26, blur=30, alpha=88, dy=22)
    canvas.alpha_composite(sh_img, (pad - sp, pad - sp))
    d = ImageDraw.Draw(canvas)
    ox, oy = pad, pad
    d.rounded_rectangle([ox, oy, ox + lid_w, oy + lid_h], radius=22, fill=(20, 32, 48, 255))
    inner = Image.new("RGB", (screen_w, screen_h), (10, 20, 32))
    inner.paste(shot, (bezel, bezel))
    inner.putalpha(rounded_mask((screen_w, screen_h), 10))
    canvas.paste(inner, (ox + 11, oy + 11), inner)
    d.ellipse([ox + lid_w / 2 - 4, oy + 4, ox + lid_w / 2 + 4, oy + 12], fill=(60, 78, 96, 255))
    base_y = oy + lid_h
    d.rounded_rectangle([ox - 26, base_y, ox + lid_w + 26, base_y + base_h], radius=10, fill=(203, 211, 220, 255))
    d.rounded_rectangle([ox + lid_w / 2 - 90, base_y, ox + lid_w / 2 + 90, base_y + 7], radius=4, fill=(176, 186, 198, 255))
    out = canvas.crop((0, 0, canvas.size[0], base_y + base_h + pad))
    out.save(out_png)
    print("  ", os.path.basename(out_png), out.size)


def browser_frame(shot_png, out_png, url="127.0.0.1:5173"):
    shot = Image.open(shot_png).convert("RGB")
    sw = 1500
    shh = int(shot.size[1] * sw / shot.size[0])
    shot = shot.resize((sw, shh), Image.LANCZOS)
    bar, radio = 62, 16
    w, h = sw + 2 * radio, shh + bar + 2 * radio
    pad = 50
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh_img, sp = shadow_of((w, h), 18, blur=26, alpha=80, dy=18)
    canvas.alpha_composite(sh_img, (pad - sp, pad - sp))
    d = ImageDraw.Draw(canvas)
    ox, oy = pad, pad
    d.rounded_rectangle([ox, oy, ox + w, oy + h], radius=18, fill=(255, 255, 255, 255))
    d.rounded_rectangle([ox, oy, ox + w, oy + bar], radius=18, fill=(238, 243, 249, 255))
    d.rectangle([ox, oy + bar - 18, ox + w, oy + bar], fill=(238, 243, 249, 255))
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = ox + 26 + i * 24
        d.ellipse([cx - 7, oy + 22, cx + 7, oy + 36], fill=col + (255,))
    pill = [ox + 120, oy + 14, ox + w - 26, oy + 46]
    d.rounded_rectangle(pill, radius=16, fill=(255, 255, 255, 255), outline=(214, 226, 238, 255))
    d.text((pill[0] + 18, pill[1] + 9), url, font=font_of(FONTS, 20), fill=(90, 113, 132))
    page = Image.new("RGB", (sw, shh), (255, 255, 255))
    page.paste(shot, (0, 0))
    canvas.paste(page, (ox + radio, oy + bar))
    canvas.save(out_png)
    print("  ", os.path.basename(out_png), canvas.size)


laptop_frame(os.path.join(SHOTS, "02-chat.png"), os.path.join(ART, "shot-laptop-chat.png"))
browser_frame(os.path.join(SHOTS, "03-reclaim.png"), os.path.join(ART, "shot-browser-risk.png"),
              "127.0.0.1:5173   ·   糖尿病风险 / 可回收模拟器")
browser_frame(os.path.join(SHOTS, "04-cvd-new.png"), os.path.join(ART, "shot-browser-cvd.png"),
              "127.0.0.1:5173/cvd   ·   China-PAR 家族史进入方程")
print("完成")
