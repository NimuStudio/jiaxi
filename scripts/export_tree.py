# -*- coding: utf-8 -*-
"""把演示家系导出成 SVG（再由 node/sharp 转 PNG），供答辩稿使用。

数据取自 app/chat/page.tsx 的 DEMO 常量——与 /chat?demo=1 页面上渲染的是同一份，
不是另画的示意图。

    python scripts/export_tree.py            # 生成 docs/deck-assets/tree.svg
"""
import os, io

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "deck-assets", "tree.svg")

INK = "#1A6FB5"
TEXT = "#0F2A44"
MUTED = "#4A6B8A"
RED = "#C0392B"
LINE = "#8AA3BB"
NODE = 54          # 节点边长
W, H = 1180, 720

# (关系, 性别, 患病, 世代行, x 坐标, 是否本人)
PEOPLE = [
    ("爷爷", "m", "糖尿病", 0, 170, False),
    ("奶奶", "f", "", 0, 300, False),
    ("外婆", "f", "中风 68 岁", 0, 790, False),
    ("父亲", "m", "心梗 52 岁", 1, 235, False),
    ("母亲", "f", "", 1, 660, False),
    ("舅舅", "m", "糖尿病 45 岁", 1, 860, False),
    ("本人", "m", "", 2, 447, True),
]
ROW_Y = [110, 340, 570]


def node(cx, cy, sex, affected, me):
    half = NODE / 2
    if sex == "m":
        shape = f'<rect x="{cx-half}" y="{cy-half}" width="{NODE}" height="{NODE}" rx="6"'
    else:
        shape = f'<circle cx="{cx}" cy="{cy}" r="{half}"'
    fill = INK if affected else "#FFFFFF"
    sw = 3 if me else 2
    stroke = RED if me else INK
    dash = ' stroke-dasharray="7 5"' if me else ""
    shape += f' fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/>'
    return shape


def label(cx, cy, name, disease):
    out = [f'<text x="{cx}" y="{cy + NODE/2 + 26}" text-anchor="middle" font-size="20" '
           f'font-weight="700" fill="{TEXT}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">{name}</text>']
    if disease:
        out.append(f'<text x="{cx}" y="{cy + NODE/2 + 50}" text-anchor="middle" font-size="16" '
                   f'fill="{RED}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">{disease}</text>')
    return "".join(out)


def line(x1, y1, x2, y2, w=2):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{LINE}" stroke-width="{w}" fill="none"/>'


def build():
    # 裁到内容包围盒：画布留白会让缩进 PPT 后字号被动变小
    VX, VY, VW, VH = 120, 60, 810, 580
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VX} {VY} {VW} {VH}" '
             f'width="{VW}" height="{VH}">']

    pos = {(n): (x, ROW_Y[r]) for (n, s, d, r, x, me) in
           [(p[0], p[1], p[2], p[3], p[4], p[5]) for p in PEOPLE]}
    y0, y1, y2 = ROW_Y

    # 爷爷 + 奶奶（婚配）→ 父亲
    parts.append(line(197, y0, 273, y0))                 # 婚配横线
    parts.append(line(235, y0, 235, y1 - NODE / 2))      # 下落
    # 外婆 → 母亲 / 舅舅
    parts.append(line(790, y0 + NODE / 2, 790, y1 - 90))
    parts.append(line(660, y1 - 90, 860, y1 - 90))       # 兄弟姐妹横线
    parts.append(line(660, y1 - 90, 660, y1 - NODE / 2))
    parts.append(line(860, y1 - 90, 860, y1 - NODE / 2))
    # 父亲 + 母亲（婚配）→ 本人
    parts.append(line(262, y1, 633, y1))
    parts.append(line(447, y1, 447, y2 - NODE / 2))

    for (name, sex, disease, row, x, me) in PEOPLE:
        affected = bool(disease)
        parts.append(node(x, ROW_Y[row], sex, affected, me))
        parts.append(label(x, ROW_Y[row], name, disease))

    # 图例已删：PPT 里那行说明比图里的小字更清楚，两处重复反而占高度
    ly = 0
    parts.append(f'<rect x="150" y="{ly - 16}" width="26" height="26" rx="4" fill="#FFFFFF" stroke="{INK}" stroke-width="2"/>')
    parts.append(f'<text x="186" y="{ly + 6}" font-size="17" fill="{MUTED}" font-family="Microsoft YaHei, sans-serif">男</text>')
    parts.append(f'<circle cx="256" cy="{ly - 3}" r="13" fill="#FFFFFF" stroke="{INK}" stroke-width="2"/>')
    parts.append(f'<text x="278" y="{ly + 6}" font-size="17" fill="{MUTED}" font-family="Microsoft YaHei, sans-serif">女</text>')
    parts.append(f'<rect x="326" y="{ly - 16}" width="26" height="26" rx="4" fill="{INK}" stroke="{INK}" stroke-width="2"/>')
    parts.append(f'<text x="362" y="{ly + 6}" font-size="17" fill="{MUTED}" font-family="Microsoft YaHei, sans-serif">实心 = 有该病记录</text>')
    parts.append(f'<rect x="612" y="{ly - 16}" width="26" height="26" rx="4" fill="#FFFFFF" stroke="{RED}" stroke-width="3" stroke-dasharray="7 5"/>')
    parts.append(f'<text x="648" y="{ly + 6}" font-size="17" fill="{MUTED}" font-family="Microsoft YaHei, sans-serif">虚线 = 本人</text>')

    parts.append("</svg>")
    return "".join(parts)


if __name__ == "__main__":
    svg = build()
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(svg)
    print("SVG ->", os.path.abspath(OUT), len(svg), "字节")
