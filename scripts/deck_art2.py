# -*- coding: utf-8 -*-
"""PPT 背景与设备外框（程序绘制）。

本轮新增：
  content-bg-0..5.png  按栏目区分的浅色背景（每种色调不同，避免全篇一张皮）
  shot-laptop-chat.png 家系梳理截图套笔记本外框
  shot-browser-risk.png / shot-browser-cvd.png  风险页套浏览器外框
"""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "docs", "deck-assets")
SHOTS = os.path.join(ROOT, "docs", "screenshots")
os.makedirs(ART, exist_ok=True)
W, H = 2560, 1440

FONT_PATHS = ["C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/msyhbd.ttc",
              "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/simsun.ttc"]


def load_font(size, bold=False):
    order = FONT_PATHS if not bold else [FONT_PATHS[0], FONT_PATHS[1]] + FONT_PATHS[2:]
    for p in order:
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
        for i in range(26, 0, -1):
            k = i / 26
            rr = r * k
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color + (int(alpha * (1 - k) ** 1.8),))
        layer = layer.filter(ImageFilter.GaussianBlur(r * 0.12))
        base = Image.alpha_composite(base, layer)
    return base


def wire(img, color, alpha=12, scale=1.0, offset=(0, 0), seed=11):
    """家系纹样：婚配横线 + 子女垂线"""
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    ox, oy = offset
    lw = max(2, int(2 * scale))
    couples = [((0.10, 0.22), (0.20, 0.22)), ((0.42, 0.12), (0.52, 0.12)),
               ((0.62, 0.60), (0.72, 0.60)), ((0.22, 0.70), (0.32, 0.70))]
    for a1, a2 in couples:
        p1 = (ox + a1[0] * w * scale, oy + a1[1] * h * scale)
        p2 = (ox + a2[0] * w * scale, oy + a2[1] * h * scale)
        d.line([p1, p2], fill=color + (alpha,), width=lw)
        midx = (p1[0] + p2[0]) / 2
        drop = (midx, p2[1] + h * 0.10 * scale)
        d.line([(midx, p1[1]), drop], fill=color + (alpha,), width=lw)
        kids = rnd.choice([1, 2])
        for k in range(kids):
            kx = midx + (k - (kids - 1) / 2) * w * 0.07 * scale
            ty = drop[1] + h * 0.09 * scale
            d.line([drop, (kx, ty)], fill=color + (alpha,), width=lw)
            r = 9 * scale
            d.ellipse([kx - r, ty - r, kx + r, ty + r], outline=color + (int(alpha * 1.6),), width=lw)
        for p in (p1, p2):
            r = 10 * scale
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], outline=color + (int(alpha * 1.6),), width=lw)
    layer = layer.filter(ImageFilter.GaussianBlur(1.2 * scale))
    return Image.alpha_composite(img.convert("RGBA"), layer)


def arc_motif(img, color, alpha=26, cx=1.02, cy=-0.05, r=0.42, width=90):
    """右上角的大圆弧：给每页一点方向感和层次，不抢正文"""
    w, h = img.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    R = r * w
    box = [cx * w - R, cy * h - R, cx * w + R, cy * h + R]
    d.arc(box, start=90, end=270, fill=color + (alpha,), width=width)
    layer = layer.filter(ImageFilter.GaussianBlur(3))
    return Image.alpha_composite(img.convert("RGBA"), layer)


# 六个栏目的色调（浅底 + 主色），保证正文黑字依然清晰
SECTIONS = [
    ("项目背景", (26, 111, 181), (203, 224, 243)),
    ("方案与产品", (23, 127, 165), (203, 229, 240)),
    ("技术路线", (15, 124, 140), (200, 232, 236)),
    ("准确性与选型", (59, 91, 165), (209, 218, 240)),
    ("价值与落地", (18, 121, 110), (202, 232, 226)),
    ("团队", (91, 90, 166), (214, 214, 240)),
]

for idx, (name, tone, wash) in enumerate(SECTIONS):
    bg = gradient((W, H), [(0.0, (246, 250, 254)), (0.55, (240, 246, 252)), (1.0, (232, 241, 250))])
    bg = soft_blobs(bg, [(W * 0.97, H * 0.02, W * 0.34, wash, 120),
                         (W * 0.01, H * 1.0, W * 0.26, wash, 70)])
    bg = arc_motif(bg, tone, alpha=30, cx=1.04, cy=-0.10, r=0.34, width=110)
    bg = wire(bg, color=tone, alpha=11, scale=1.0, offset=(W * 0.03, H * 0.05))
    bg.convert("RGB").save(os.path.join(ART, f"content-bg-{idx}.png"), optimize=True)
    print("  bg", idx, name, "->", f"content-bg-{idx}.png")


# ---------------- 设备 / 浏览器外框 ----------------
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
    d.rounded_rectangle([pad, pad + dy, pad + w, pad + h + dy], radius=radius,
                        fill=(16, 42, 68, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(canvas, layer), pad


def screenshot(path):
    return Image.open(path).convert("RGB")


def laptop_frame(shot_png, out_png):
    """笔记本外框：深色机身 + 屏幕内嵌 + 底座"""
    shot = screenshot(shot_png)
    sw, sh = 1600, 1000
    shot = shot.resize((sw, sh), Image.LANCZOS)
    bezel = 22
    screen_w, screen_h = sw + bezel * 2, sh + bezel * 2
    lid_w, lid_h = screen_w + 22, screen_h + 22
    base_h = 34
    pad = 60
    canvas = Image.new("RGBA", (lid_w + pad * 2, lid_h + base_h + pad * 2), (0, 0, 0, 0))

    sh_img, sp = shadow_of((lid_w, lid_h + base_h), 26, blur=30, alpha=80, dy=20)
    canvas.alpha_composite(sh_img, (pad - sp, pad - sp))

    d = ImageDraw.Draw(canvas)
    ox, oy = pad, pad
    # 屏幕外壳
    d.rounded_rectangle([ox, oy, ox + lid_w, oy + lid_h], radius=22, fill=(24, 38, 56, 255))
    inner = Image.new("RGB", (screen_w, screen_h), (10, 20, 32))
    inner.paste(shot, (bezel, bezel))
    inner.putalpha(rounded_mask((screen_w, screen_h), 10))
    canvas.paste(inner, (ox + 11, oy + 11), inner)
    # 摄像头
    d.ellipse([ox + lid_w / 2 - 4, oy + 4, ox + lid_w / 2 + 4, oy + 12], fill=(60, 78, 96, 255))
    # 底座
    base_y = oy + lid_h
    d.rounded_rectangle([ox - 26, base_y, ox + lid_w + 26, base_y + base_h], radius=10,
                        fill=(203, 211, 220, 255))
    d.rounded_rectangle([ox + lid_w / 2 - 90, base_y, ox + lid_w / 2 + 90, base_y + 7], radius=4,
                        fill=(176, 186, 198, 255))
    out = canvas.crop((0, 0, canvas.size[0], base_y + base_h + pad))
    out.save(out_png)
    print("  ", os.path.basename(out_png), out.size)


def browser_frame(shot_png, out_png, url="127.0.0.1:5173"):
    shot = screenshot(shot_png)
    sw = 1500
    shh = int(shot.size[1] * sw / shot.size[0])
    shot = shot.resize((sw, shh), Image.LANCZOS)
    bar = 62
    radio = 16
    w, h = sw + 2 * radio, shh + bar + 2 * radio
    pad = 50
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh_img, sp = shadow_of((w, h), 18, blur=26, alpha=72, dy=16)
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
    f = load_font(20)
    d.text((pill[0] + 18, pill[1] + 9), url, font=f, fill=(90, 113, 132))
    # 页面
    page = Image.new("RGB", (sw, shh), (255, 255, 255))
    page.paste(shot, (0, 0))
    page.putalpha(rounded_mask((sw, shh), 0))
    canvas.paste(page, (ox + radio, oy + bar), page)
    canvas.save(out_png)
    print("  ", os.path.basename(out_png), canvas.size)


laptop_frame(os.path.join(SHOTS, "02-chat.png"), os.path.join(ART, "shot-laptop-chat.png"))
browser_frame(os.path.join(SHOTS, "03-risk.png"), os.path.join(ART, "shot-browser-risk.png"),
              "127.0.0.1:5173/risk")
browser_frame(os.path.join(SHOTS, "04-cvd.png"), os.path.join(ART, "shot-browser-cvd.png"),
              "127.0.0.1:5173/cvd")
print("完成")
