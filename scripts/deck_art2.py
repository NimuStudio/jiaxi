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


SECTIONS = [
    ("项目背景", (26, 111, 181), (198, 220, 241), "01", "wire"),
    ("方案与产品", (23, 127, 165), (196, 225, 238), "02", "flow"),
    ("技术路线", (15, 124, 140), (192, 228, 234), "03", "graph"),
    ("准确性与选型", (59, 91, 165), (203, 214, 238), "04", "target"),
    ("价值与落地", (18, 121, 110), (194, 228, 221), "05", "bars"),
    ("团队", (91, 90, 166), (208, 209, 238), "06", "people"),
]

for idx, (name, tone, wash, num, motif) in enumerate(SECTIONS):
    bg = gradient((W, H), [(0.0, (247, 250, 254)), (0.50, (241, 246, 252)), (1.0, (233, 241, 250))])
    bg = soft_blob(bg, W * 0.98, H * 0.04, W * 0.36, wash, 130)
    bg = soft_blob(bg, W * 0.02, H * 1.02, W * 0.28, wash, 80)
    bg = dot_grid(bg, tone, alpha=30, pitch=36, radius=2.4)
    bg = arcs(bg, W * 1.02, H * -0.02, [W * 0.30, W * 0.38, W * 0.46], tone, alpha=30, width=3)
    # 数字放在右缘中部并露出大半：只露一条边时会被误读成无意义的色块
    bg = big_numeral(bg, num, tone, alpha=15, size=700, cx=0.975, cy=0.46)

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
plain = dot_grid(plain, (26, 111, 181), alpha=28, pitch=36, radius=2.4)
plain = arcs(plain, W * 1.02, H * -0.02, [W * 0.30, W * 0.40, W * 0.50], (26, 111, 181), alpha=26, width=3)
plain = pedestal_wire(plain, (26, 111, 181), alpha=14, scale=1.05, offset=(W * 0.02, H * 0.04))
plain = grain(plain, amount=4.0)
plain = vignette(plain, alpha=28)
plain.convert("RGB").save(os.path.join(ART, "content-bg-plain.jpg"), quality=JPEG_Q, optimize=True)
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
browser_frame(os.path.join(SHOTS, "03-risk.png"), os.path.join(ART, "shot-browser-risk.png"), "127.0.0.1:5173/risk")
browser_frame(os.path.join(SHOTS, "04-cvd.png"), os.path.join(ART, "shot-browser-cvd.png"), "127.0.0.1:5173/cvd")
print("完成")
