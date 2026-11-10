# -*- coding: utf-8 -*-
"""在封面背景图底部烘焙「PEDIGREE」描边大字。

为什么烘焙进图而不是用 PPT 文本框：
  PPT 的「透明填充 + 描边」在 LibreOffice 里会被渲染成实心灰，
  换个播放器又变样。这是纯装饰的肌理，烘焙进背景反而是唯一能保证
  每一台机器都长一样的做法（代价：不可编辑，需要改动时重跑本脚本）。
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, "docs", "deck-assets")
BOLD = ["C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/Arial Bold.ttf",
        "C:/Windows/Fonts/seguisb.ttf"]


def bold_font(size):
    for p in BOLD:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def bake_wordmark(path, text="PEDIGREE", size_px=352, tracking=0.14,
                  stroke=3, color=(255, 255, 255, 76)):
    im = Image.open(path).convert("RGBA")
    W, H = im.size
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    font = bold_font(size_px)
    widths = [font.getlength(ch) for ch in text]
    gap = size_px * tracking
    total = sum(widths) + gap * (len(text) - 1)
    x = (W - total) / 2
    y = H - size_px * 0.86          # 下缘被画布裁掉，形成「地面上浮起」的效果
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=(0, 0, 0, 0), stroke_width=stroke, stroke_fill=color)
        x += w + gap
    out = Image.alpha_composite(im, layer).convert("RGB")
    out.save(path, optimize=True)
    print("  已烘焙描边大字 ->", os.path.basename(path), out.size)


bake_wordmark(os.path.join(ART, "cover-bg.png"))
