# -*- coding: utf-8 -*-
"""生成「家系」比赛答辩 PPT（v2）。

v2 相对 v1 的变化（参考竞赛模板 deep_eye.pptx 的骨架）：
  · 顶部六栏目导航条，当前栏目高亮 —— 评委随时知道讲到哪
  · 增加目录页、落地价值页、团队页、结尾页
  · 标题一律写成断言句（先说结论）
  · 关键数字用主色/红色强调，配大数字卡片
保留自己的视觉语言（浅蓝底 + 主蓝描边），不套用参考模板的青色渐变与外部图表。
"""
import os
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt

BG = RGBColor(0xF2, 0xF7, 0xFC)
SURFACE = RGBColor(0xFF, 0xFF, 0xFF)
TEXT = RGBColor(0x0F, 0x2A, 0x44)
MUTED = RGBColor(0x4A, 0x6B, 0x8A)
FAINT = RGBColor(0x8A, 0xA3, 0xBB)
LINE = RGBColor(0xDB, 0xE7, 0xF3)
LINE2 = RGBColor(0xC2, 0xD6, 0xE9)
PRIMARY = RGBColor(0x1A, 0x6F, 0xB5)
PRIMARY_SOFT = RGBColor(0xEA, 0xF3, 0xFB)
RECLAIM = RGBColor(0x0F, 0x7C, 0x8C)
RECLAIM_SOFT = RGBColor(0xE6, 0xF4, 0xF6)
DANGER = RGBColor(0xB4, 0x23, 0x18)

EA = "微软雅黑"
CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(CWD, "docs", "screenshots")
ART = os.path.join(CWD, "docs", "deck-assets")
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
INK_SOFT = RGBColor(0x9F, 0xBC, 0xD8)

NAV = ["项目背景", "方案与产品", "技术路线", "准确性与选型", "价值与落地", "团队"]

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
M = 0.78
W = 13.333 - 2 * M


def set_font(run, size=14, bold=False, color=TEXT, latin=None):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.color.rgb = color
    f.name = latin or EA
    rPr = run._r.get_or_add_rPr()
    A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    for tag in ("ea", "cs"):
        el = rPr.find(A + tag)
        if el is None:
            from lxml import etree
            el = etree.SubElement(rPr, A + tag)
        el.set("typeface", EA)


def text_box(slide, x, y, w, h, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.paragraphs[0].alignment = align
    return tf


def para(tf, text, size=14, bold=False, color=TEXT, first=False, line=None,
         space_before=0, align=None, latin=None):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    if align is not None:
        p.alignment = align
    p.space_before = Pt(space_before)
    if line:
        p.line_spacing = line
    r = p.add_run()
    r.text = text
    set_font(r, size, bold, color, latin)
    return p


def rich(tf, parts, size=13, first=False, line=None):
    """一段里混排多种颜色：parts = [(text, bold, color), ...]"""
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    if line:
        p.line_spacing = line
    for text, bold, color in parts:
        r = p.add_run()
        r.text = text
        set_font(r, size, bold, color)
    return p


def rect(slide, x, y, w, h, fill=None, line=None, radius=True):
    s = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE,
                               Inches(x), Inches(y), Inches(w), Inches(h))
    if radius:
        s.adjustments[0] = 0.06
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = Pt(1)
    s.shadow.inherit = False
    return s


def nav_bar(slide, active):
    """顶部栏目导航：当前栏目主色加粗，其余淡灰。"""
    x = M
    for i, name in enumerate(NAV):
        on = i == active
        w = 1.62 if on else 1.52
        tf = text_box(slide, x, 0.30, w, 0.32)
        para(tf, name, size=11 if on else 10.5, bold=on, color=PRIMARY if on else FAINT, first=True)
        if on:
            rect(slide, x, 0.62, w - 0.35, 0.045, fill=PRIMARY, radius=False)
        x += w + 0.06
    rect(slide, M, 0.78, W, 0.012, fill=LINE, radius=False)


from pptx.enum.shapes import MSO_CONNECTOR


def hline_shape(s, x1, x2, y, color=LINE, w=1.0, dash=None):
    cn = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y), Inches(x2), Inches(y))
    cn.line.color.rgb = color
    cn.line.width = Pt(w)
    if dash:
        cn.line.dash_style = dash
    return cn


def f1_chart(s, x, y, w, h, values, labels, notes):
    """手绘折线图：为了能逐点标注「这一跳改了什么」。

    原生图表无法精确控制注记位置，所以坐标全部自己算；
    数值仍以文本呈现，改数只需改这里的 values。
    """
    vmin, vmax = 0.80, 1.05
    n = len(values)
    pad_l, pad_r = 0.62, 0.22
    pad_t, pad_b = 0.26, 1.16
    px0, px1 = x + pad_l, x + w - pad_r
    py0, py1 = y + pad_t, y + h - pad_b

    def X(i):
        return px0 + (px1 - px0) * i / (n - 1)

    def Y(v):
        return py1 - (py1 - py0) * (v - vmin) / (vmax - vmin)

    # 网格与刻度
    tick = 0.80
    while tick <= vmax + 1e-9:
        yy = Y(tick)
        hline_shape(s, px0, px1, yy, color=LINE, w=0.75)
        tf = text_box(s, x + 0.04, yy - 0.11, 0.5, 0.22, align=PP_ALIGN.RIGHT)
        para(tf, f"{tick:.2f}".rstrip("0").rstrip("."), size=8.5, color=FAINT, first=True,
             align=PP_ALIGN.RIGHT)
        tick += 0.05

    # 折线
    fb = s.shapes.build_freeform(Inches(X(0)), Inches(Y(values[0])), scale=1.0)
    fb.add_line_segments([(Inches(X(i)), Inches(Y(values[i]))) for i in range(1, n)], close=False)
    poly = fb.convert_to_shape()
    poly.fill.background()
    poly.line.color.rgb = PRIMARY
    poly.line.width = Pt(2.5)
    poly.shadow.inherit = False

    for i, v in enumerate(values):
        cx, cy = X(i), Y(v)
        last = i == n - 1
        r = 0.075
        dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(cx - r), Inches(cy - r),
                                 Inches(2 * r), Inches(2 * r))
        dot.fill.solid()
        dot.fill.fore_color.rgb = RECLAIM if last else PRIMARY
        dot.line.color.rgb = SURFACE
        dot.line.width = Pt(1.5)
        dot.shadow.inherit = False
        # 数值：首尾点向内收，否则会压到纵轴刻度或右侧卡片
        if i == 0:
            lx, lw, la = cx + 0.02, 1.0, PP_ALIGN.LEFT
        elif last:
            lx, lw, la = cx - 1.02, 1.0, PP_ALIGN.RIGHT
        else:
            lx, lw, la = cx - 0.55, 1.1, PP_ALIGN.CENTER
        tf = text_box(s, lx, cy - 0.34, lw, 0.24, align=la)
        para(tf, f"{v:.3f}", size=9.5, bold=True, color=RECLAIM if last else PRIMARY,
             first=True, align=la)
        # 版本号
        tf = text_box(s, cx - 0.55, py1 + 0.10, 1.1, 0.24, align=PP_ALIGN.CENTER)
        para(tf, labels[i], size=10, bold=True, color=MUTED, first=True, align=PP_ALIGN.CENTER)
        # 该跳改了什么
        tf = text_box(s, cx - 0.62, py1 + 0.38, 1.24, 0.5, align=PP_ALIGN.CENTER)
        para(tf, notes[i], size=8.5, color=FAINT, first=True, align=PP_ALIGN.CENTER, line=1.25)
        # 刻度短线
        hline_shape(s, cx, cx, py1, color=LINE2, w=1.0)

    # 坐标轴
    hline_shape(s, px0, px1, py1, color=LINE2, w=1.25)


ICONS = os.path.join(ART, "icons")


def holdout_stats():
    """留出集构成：直接读 data/eval/*.jsonl 现算，避免把数字手抄进 PPT 后失效。"""
    import json
    import re
    import statistics as st
    base = os.path.join(CWD, "data", "eval")
    sets = [("v2", "colloquial-holdout-v2"), ("v3", "colloquial-holdout-v3"),
            ("v5", "colloquial-holdout-v5"), ("v7", "colloquial-holdout-v7"),
            ("v8", "colloquial-holdout-v8"), ("v9", "colloquial-holdout-v9")]
    CONT = re.compile("也是|都有|都高|也高|也痛风|也一样")
    NEG = re.compile("没病|没问题|没事|健康|身体(挺|还|好)|没查|身体好")
    AGE = re.compile("岁")
    rows, tot = [], [0, 0, 0, 0, 0]
    for tag, name in sets:
        path = os.path.join(base, name + ".jsonl")
        if not os.path.exists(path):
            continue
        n = chars = rels = age = neg = cont = multi = 0
        for line in open(path, encoding="utf-8"):
            if not line.strip():
                continue
            r = json.loads(line)
            t = r["input"]
            n += 1
            chars += len(t)
            rs = {q.get("relation") for q in (r.get("expected") or []) if q.get("relation")}
            rels += len(rs)
            age += 1 if AGE.search(t) else 0
            neg += 1 if NEG.search(t) else 0
            cont += 1 if CONT.search(t) else 0
            multi += 1 if len(r.get("expected") or []) > 1 else 0
        rows.append((tag, n, round(chars / n, 1), round(rels / n, 1), age, neg, cont, multi))
        for i, v in enumerate((n, age, neg, cont, multi)):
            tot[i] += v
    return rows, tot


def art_path(name):
    """背景是大图、按 JPEG 存（体积小一个数量级）；图标与截图带透明通道仍是 PNG。"""
    for ext in (".jpg", ".png"):
        p = os.path.join(ART, name + ext)
        if os.path.exists(p):
            return p
    return os.path.join(ART, name + ".png")


def outline_word(slide, text, x, y, w, h, size=140, color="FFFFFF", alpha=20,
                 spc=0.14, line_w=1.15):
    """描边大字：与网站开屏那层 PEDIGREE 同款处理（描边、透明填充、宽字距）。

    用作页面肌理而不是标题——所以只描边、不给填充，
    并且故意让下半部分被页面底边裁掉，读起来像地面上的暗纹。
    """
    from lxml import etree
    A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    tf = text_box(slide, x, y, w, h, align=PP_ALIGN.CENTER)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    set_font(r, size, True, RGBColor(0xFF, 0xFF, 0xFF), latin="Arial")
    rPr = r._r.get_or_add_rPr()
    rPr.set("spc", str(int(spc * size * 100)))
    for tag in ("solidFill", "ln"):
        for el in rPr.findall(A + tag):
            rPr.remove(el)
    # 先放描边，再放 noFill（顺序无关，但 noFill 覆盖填充）
    ln = etree.SubElement(rPr, A + "ln")
    ln.set("w", str(int(line_w * 12700)))
    sf = etree.SubElement(ln, A + "solidFill")
    clr = etree.SubElement(sf, A + "srgbClr")
    clr.set("val", color)
    al = etree.SubElement(clr, A + "alpha")
    al.set("val", str(int(alpha * 1000)))
    etree.SubElement(rPr, A + "noFill")
    return tf


def new_slide(section, title, sub=None, icon=None):
    s = prs.slides.add_slide(BLANK)
    bg_path = art_path(f"content-bg-{section}")
    if not os.path.exists(bg_path):
        bg_path = art_path("content-bg")
    s.shapes.add_picture(bg_path, 0, 0, width=prs.slide_width, height=prs.slide_height)
    rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
    nav_bar(s, section)
    tx = M
    if icon:
        path = os.path.join(ICONS, icon + ".png")
        if os.path.exists(path):
            s.shapes.add_picture(path, Inches(M + 0.02), Inches(1.03), Inches(0.46), Inches(0.46))
            tx = M + 0.66
    tf = text_box(s, tx, 1.02, 13.333 - tx - M, 0.62)
    para(tf, title, size=26, bold=True, first=True)
    if sub:
        tf = text_box(s, tx, 1.62, 13.333 - tx - M, 0.4)
        para(tf, sub, size=12.5, color=MUTED, first=True)
    return s


FOOTERS = {}


def footer(slide, idx=None):
    """页脚。页码不再手写：登记下来，生成结束后按真实页序统一填，
    这样中间插页不用手工改后面每一页的编号（插错过一次）。"""
    tf = text_box(slide, M, 6.98, 8, 0.28)
    para(tf, "家系 · 家族健康风险量化", size=9, color=FAINT, first=True)
    tf = text_box(slide, 13.333 - M - 1.2, 6.98, 1.2, 0.28, align=PP_ALIGN.RIGHT)
    para(tf, "00", size=9, color=FAINT, first=True, align=PP_ALIGN.RIGHT)
    FOOTERS[id(slide)] = tf


def stat_card(slide, x, y, w, h, big, unit, label, color=PRIMARY, compact=False):
    rect(slide, x, y, w, h, fill=SURFACE, line=LINE)
    if compact:
        # 矮卡片：数字 24pt、标签紧贴下方，否则标签会掉出卡片压到下一张
        tf = text_box(slide, x + 0.20, y + 0.08, w - 0.40, 0.46)
        rich(tf, [(big, True, color), (unit, False, color)], size=23, first=True)
        tf = text_box(slide, x + 0.20, y + 0.52, w - 0.40, 0.3)
        para(tf, label, size=9.5, color=MUTED, first=True)
        return
    tf = text_box(slide, x + 0.22, y + 0.20, w - 0.44, 0.6)
    rich(tf, [(big, True, color), (unit, False, color)], size=30, first=True)
    tf = text_box(slide, x + 0.22, y + 0.85, w - 0.44, 0.6)
    para(tf, label, size=10.5, color=MUTED, first=True, line=1.35)


def picture_fit(slide, path, x, y, max_w, max_h):
    from PIL import Image
    iw, ih = Image.open(path).size
    scale = min(max_w / iw, max_h / ih)
    w, h = iw * scale, ih * scale
    slide.shapes.add_picture(path, Inches(x + (max_w - w) / 2), Inches(y + (max_h - h) / 2),
                             Inches(w), Inches(h))
    return w, h


# ============ P1 封面（深色全幅背景图） ============
s = prs.slides.add_slide(BLANK)
s.shapes.add_picture(art_path("cover-bg"), 0, 0,
                     width=prs.slide_width, height=prs.slide_height)

GLOW = RGBColor(0x7F, 0xC3, 0xE8)
tf = text_box(s, M, 1.30, 7.2, 0.4)
rich(tf, [("AI + Web", True, GLOW), ("　/　", False, RGBColor(0x6E, 0x92, 0xB4)),
          ("AI 与健康", True, GLOW)], size=12.5, first=True)
tf = text_box(s, M, 1.80, 7.2, 1.2)
para(tf, "家  系", size=64, bold=True, color=WHITE, first=True)
tf = text_box(s, M, 3.15, 6.9, 1.4)
para(tf, "把家族口述的病史，整理成一张家系图", size=20, color=WHITE, first=True, line=1.4)
para(tf, "并算出你的风险里，有多少是「能拿回来的」", size=20, color=WHITE, line=1.4)

rect(s, M, 4.85, 1.5, 0.05, fill=GLOW, radius=False)
tf = text_box(s, M, 5.05, 6.9, 0.4)
para(tf, "FINDRISC · China-PAR · PLCOm2012　|　100% 本机推理　|　口语留出集 F1 1.000",
     size=10.5, color=RGBColor(0xB9, 0xD3, 0xE8), first=True)

info = [("作品编号", "【待填】"), ("省份", "【待填】"), ("团队", "【待填】")]
for i, (k, v) in enumerate(info):
    x = M + i * 2.45
    box = rect(s, x, 5.85, 2.25, 0.66, fill=RGBColor(0x0E, 0x33, 0x57), line=RGBColor(0x39, 0x6D, 0x9E))
    tf = text_box(s, x + 0.18, 5.90, 1.95, 0.24)
    para(tf, k, size=8.5, color=RGBColor(0x8F, 0xB2, 0xCE), first=True)
    tf = text_box(s, x + 0.18, 6.13, 1.95, 0.3)
    para(tf, v, size=11.5, bold=True, color=WHITE, first=True)

# 产品截图：白卡片压深底，形成对比
rect(s, 8.45, 1.70, 4.25, 3.15, fill=WHITE, line=None)
picture_fit(s, os.path.join(SHOTS, "02-chat.png"), 8.57, 1.82, 4.01, 2.91)
tf = text_box(s, 8.45, 4.95, 4.25, 0.3, align=PP_ALIGN.CENTER)
para(tf, "口述 → 家系图 → 风险 → 可回收", size=9.5, color=RGBColor(0xA8, 0xC6, 0xDF),
     first=True, align=PP_ALIGN.CENTER)

# ============ P2 目录 ============
s = prs.slides.add_slide(BLANK)
s.shapes.add_picture(art_path("content-bg-plain"), 0, 0,
                     width=prs.slide_width, height=prs.slide_height)
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
tf = text_box(s, M, 1.1, 6, 0.5)
para(tf, "目录  CONTENTS", size=12, bold=True, color=PRIMARY, first=True)
tf = text_box(s, M, 1.55, 8, 0.7)
para(tf, "六个问题，一条主线", size=30, bold=True, first=True)

toc = [
    ("01", "tree", "项目背景", "家族史是免费的风险信号，却几乎没人用"),
    ("02", "flag", "方案与产品", "口述进、行动出；两屏演示完整闭环"),
    ("03", "chip", "技术路线", "数据流 / 分层架构 / 部署视图"),
    ("04", "target", "准确性与选型", "留出集 F1 1.000；判定为什么不用大模型"),
    ("05", "trend", "价值与落地", "差异化、部署成本与实测性能"),
    ("06", "team", "团队", "我们是谁，各自负责什么"),
]
for i, (num, ic, name, desc) in enumerate(toc):
    col = i % 2
    row = i // 2
    x = M + col * 5.95
    y = 2.45 + row * 1.32
    rect(s, x, y - 0.02, 0.52, 0.52, fill=PRIMARY_SOFT, line=LINE)
    s.shapes.add_picture(os.path.join(ICONS, ic + ".png"), Inches(x + 0.10),
                         Inches(y + 0.08), Inches(0.32), Inches(0.32))
    tf = text_box(s, x + 0.64, y - 0.06, 0.6, 0.32)
    para(tf, num, size=11, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 1.10, y - 0.10, 4.4, 0.4)
    para(tf, name, size=16.5, bold=True, first=True)
    tf = text_box(s, x + 1.10, y + 0.32, 4.4, 0.4)
    para(tf, desc, size=10, color=MUTED, first=True)
footer(s, 2)

# ============ P3 项目背景 ============
s = new_slide(0, "家族史是免费的风险信号，三套引擎都给它留了权重", icon="tree",
              sub="但用户手上的体检报告，从来没有家系图")
items = [
    ("01", "体检报告只解读当次指标", "「未见异常」四个字，不看你父亲 52 岁放的支架。"),
    ("02", "医院问卷把家族史压成「有 / 无」", "谁、几岁发病、几个亲属——三件最关键的事全部丢掉。"),
    ("03", "建议从不说「我这么改到底图什么」", "给建议却不复算，也不告诉你哪部分本就能拿回来。"),
]
y = 2.2
for num, h1, h2 in items:
    tf = text_box(s, M, y, 0.7, 0.35)
    para(tf, num, size=13, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, M + 0.72, y - 0.05, 6.4, 0.4)
    para(tf, h1, size=15.5, bold=True, first=True)
    tf = text_box(s, M + 0.72, y + 0.36, 6.4, 0.6)
    para(tf, h2, size=11.5, color=MUTED, first=True, line=1.35)
    y += 1.32

# 右侧：临床家系示意图（把「用户嘴上的三句话」画成医生本子里的那张图）
rect(s, 6.95, 1.95, 5.6, 3.45, fill=SURFACE, line=LINE)
picture_fit(s, os.path.join(ART, "pedigree-scene.png"), 7.05, 2.03, 5.4, 3.3)
tf = text_box(s, 6.95, 5.48, 5.6, 0.3, align=PP_ALIGN.CENTER)
para(tf, "男 = 方　女 = 圆　实心 = 患病　斜线 = 已故", size=9.5, color=FAINT, first=True,
     align=PP_ALIGN.CENTER)
tf = text_box(s, 6.95, 5.78, 5.6, 0.3, align=PP_ALIGN.CENTER)
para(tf, "这三句话，翻译过来就是临床用了六十年的家系图", size=10.5, bold=True,
     color=PRIMARY, first=True, align=PP_ALIGN.CENTER)

# 底部：家族史在三套引擎里的分量（一层横条，替代原来两个卡片）
rect(s, M, 6.12, W, 0.62, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.26, 6.24, W - 0.52, 0.4)
rich(tf, [("家族史在引擎里都有权重：", True, TEXT),
          ("FINDRISC 记 5 / 26 分", True, DANGER), ("　·　", False, FAINT),
          ("China-PAR 是独立系数，不是开关", True, DANGER), ("　·　", False, FAINT),
          ("PLCOm2012 是肺癌方程的一项", True, DANGER)], size=11.5, first=True)
footer(s, 3)

# ============ P4 引语页（浅色版：深色只留给封面） ============
s = prs.slides.add_slide(BLANK)
s.shapes.add_picture(art_path("content-bg-plain"), 0, 0,
                     width=prs.slide_width, height=prs.slide_height)
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)

s.shapes.add_picture(os.path.join(ICONS, "chat.png"), Inches(M), Inches(1.92),
                     Inches(0.34), Inches(0.34))
tf = text_box(s, M + 0.48, 1.96, 6, 0.34)
para(tf, "一 句 真 话", size=11, bold=True, color=PRIMARY, first=True)
tf = text_box(s, M, 2.50, 8.9, 2.4)
para(tf, "「我爸 52 岁放了支架，爷爷糖尿病，", size=29, bold=True, color=TEXT, first=True, line=1.5)
para(tf, "外公是脑溢血走的。」", size=29, bold=True, color=TEXT, line=1.5)
rect(s, M, 5.20, 1.2, 0.05, fill=RECLAIM, radius=False)
tf = text_box(s, M, 5.40, 8.6, 0.5)
para(tf, "这三条，任何体检 App 都不会问。", size=14, color=MUTED, first=True)

rect(s, 9.35, 2.50, 3.2, 1.95, fill=SURFACE, line=LINE)
rect(s, 9.35, 2.50, 3.2, 0.06, fill=PRIMARY, radius=False)
tf = text_box(s, 9.58, 2.66, 2.75, 1.7)
para(tf, "这一句话的价值", size=10, bold=True, color=MUTED, first=True)
rich(tf, [("5", True, PRIMARY), (" / 26", True, MUTED)], size=38)
para(tf, "FINDRISC 满分 26 分里，家族史记 5 分；", size=9.5, color=MUTED, line=1.4)
para(tf, "China-PAR 还把它作为独立系数。", size=9.5, color=MUTED, line=1.4)

# 底部：一句话 -> 家系图 -> 风险，用三个图标把动向画出来
flow = [("chat", "说一句话"), ("tree", "长出家系图"), ("target", "三个风险数字")]
for i, (ic, label) in enumerate(flow):
    x = M + i * 2.75
    rect(s, x, 6.10, 2.45, 0.66, fill=SURFACE, line=LINE)
    s.shapes.add_picture(os.path.join(ICONS, ic + ".png"), Inches(x + 0.16),
                         Inches(6.27), Inches(0.30), Inches(0.30))
    tf = text_box(s, x + 0.56, 6.26, 1.75, 0.34)
    para(tf, label, size=10.5, color=TEXT, first=True)
    if i < 2:
        ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + 2.50), Inches(6.34),
                                Inches(0.20), Inches(0.18))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2
        ar.line.fill.background(); ar.shadow.inherit = False

# ============ P5 方案总览 ============
s = new_slide(1, "口述进，行动出：四步闭环，每一步都能复核", icon="flag",
              sub="抽出来的每一条病，都能回查到用户原话")
steps = [
    ("①", "口述", "语音或一句话描述家族病史，不用填表", "输出：结构化条目"),
    ("②", "家系图", "自动结构化：谁、几岁发病、几个亲属", "输出：可点选回溯的家系图"),
    ("③", "风险", "三套引擎分别算糖代谢、心血管、肺癌", "输出：三个百分比 + 分层"),
    ("④", "可回收", "挑出可改的部分，给出这周就能做的一步", "输出：一份行动清单"),
]
cw = (W - 0.45) / 4
for i, (mark, h1, h2, h3) in enumerate(steps):
    x = M + i * (cw + 0.15)
    rect(s, x, 2.2, cw, 2.5, fill=SURFACE, line=LINE)
    tf = text_box(s, x + 0.25, 2.33, cw - 0.5, 0.4)
    para(tf, mark, size=19, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.25, 2.78, cw - 0.5, 0.4)
    para(tf, h1, size=16, bold=True, first=True)
    tf = text_box(s, x + 0.25, 3.2, cw - 0.5, 1.0)
    para(tf, h2, size=11, color=MUTED, first=True, line=1.4)
    tf = text_box(s, x + 0.25, 4.15, cw - 0.5, 0.3)
    para(tf, h3, size=10, color=PRIMARY, first=True)
    if i < 3:
        ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + cw + 0.005), Inches(3.3),
                                Inches(0.14), Inches(0.2))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2; ar.line.fill.background(); ar.shadow.inherit = False

rect(s, M, 5.05, W, 1.3, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 5.18, W - 0.6, 1.05)
para(tf, "不编数字：每个进入产品的系数都登记出处与核实状态；查不到出处的数字不上界面。",
     size=12.5, first=True, line=1.4)
para(tf, "不替代医生：所有判断写成「提示」，并给出模型置信度与拒答路径。", size=12.5, line=1.4)
footer(s, 4)

# ============ P5 产品① ============
s = new_slide(1, "第一屏：一段话，直接变成一张家系图", icon="chat")
picture_fit(s, os.path.join(ART, "shot-laptop-chat.png"), M - 0.05, 1.95, 8.35, 4.75)
for i, (h1, h2) in enumerate([
    ("语音或文字输入", "不支持语音的浏览器自动隐藏入口，不留坏入口"),
    ("逐条回查原文", "抽出的每条病都能在用户原话里找到依据"),
    ("Agent 主动追问", "缺字段就反问，不让用户自己填表"),
]):
    y = 2.25 + i * 1.42
    tf = text_box(s, 9.2, y, 3.3, 0.35)
    para(tf, h1, size=13.5, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, 9.2, y + 0.36, 3.3, 0.7)
    para(tf, h2, size=10.5, color=MUTED, first=True, line=1.35)
footer(s, 5)

# ============ P6 产品② ============
s = new_slide(1, "第二屏：算清楚，哪一部分本就能拿回来", icon="gauge")
picture_fit(s, os.path.join(ART, "shot-browser-risk.png"), M - 0.06, 1.98, 5.95, 4.05)
tf = text_box(s, M, 6.10, 5.9, 0.35)
para(tf, "可回收风险（FINDRISC）：把「可改」与「改不了」分开算", size=10.5, color=MUTED, first=True)

picture_fit(s, os.path.join(ART, "shot-browser-cvd.png"), 6.88, 1.98, 5.75, 4.05)
tf = text_box(s, 6.88, 6.10, 5.75, 0.35)
para(tf, "心血管风险（China-PAR）：改任一项实时重算，纯本地计算", size=10.5, color=MUTED, first=True)

tf = text_box(s, M, 6.45, W, 0.35)
para(tf, "界面上的每个数都能复算：China-PAR 对论文 Table 2 的 8 个验证点，偏差均 ≤ 0.35 个百分点。",
     size=10.5, color=FAINT, first=True)
footer(s, 6)

# ============ P7 现场动线 ============
s = new_slide(1, "现场一走：四个动作，两分钟", icon="play",
              sub="网页与 PPT 交替；抽取单句 0.11 秒，几乎没有等待，讲慢一点就行")
beats = [
    ("0:00 – 0:30", "说一句",
     ["打开 /chat，照这句话念：", "「我爸 52 岁放了支架，", "爷爷糖尿病，外公脑溢血。」"],
     "您听我怎么说，它就怎么记。"),
    ("0:30 – 1:00", "点节点",
     ["图已经画好了——点父亲节点", "弹出「回查原话」"],
     "抽出来的每一条，都能回到你原话。"),
    ("1:00 – 1:30", "改一项",
     ["跳 /cvd，把 BMI 从 27 拖到 24", "三个数字同时重算"],
     "改一项，数字立刻变——这就是可回收。"),
    ("1:30 – 2:00", "看结论",
     ["回 /risk，指着 33% 与那 7 分", "再说 4% 是「全部达标后」的余量"],
     "这一部分，是这周就能拿回来的。"),
]
cw = (W - 0.45) / 4
for i, (when, what, how, line) in enumerate(beats):
    x = M + i * (cw + 0.15)
    rect(s, x, 2.1, cw, 3.15, fill=SURFACE, line=LINE)
    tf = text_box(s, x + 0.24, 2.22, cw - 0.48, 0.28)
    para(tf, when, size=9.5, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.24, 2.52, cw - 0.48, 0.36)
    para(tf, what, size=15, bold=True, first=True)
    tf = text_box(s, x + 0.24, 2.95, cw - 0.48, 1.15)
    for j, ln in enumerate(how):
        para(tf, ln, size=9.5, color=MUTED, first=(j == 0), line=1.5)
    tf = text_box(s, x + 0.24, 4.25, cw - 0.48, 0.85)
    para(tf, "「" + line + "」", size=10, color=RECLAIM, first=True, line=1.4)
    if i < 3:
        ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + cw + 0.005), Inches(3.55),
                                Inches(0.12), Inches(0.18))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2; ar.line.fill.background(); ar.shadow.inherit = False

rect(s, M, 5.5, W, 1.1, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 5.62, W - 0.6, 0.9)
para(tf, "兜底：模型没起来或网络断了，直接翻 P5 / P6 的截图页，说明「演示机今天没连模型，这是同一份代码的真实截图」，",
     size=10.5, first=True, line=1.4)
para(tf, "不要在现场重启服务。启动脚本在桌面：启动家系演示.cmd（断网也不影响这套流程）。", size=10.5, color=MUTED, line=1.4)
footer(s, 7)

# ============ P8 技术路线（真正的架构图） ============
s = new_slide(2, "一张图看懂：数据怎么流动，模型只占哪一格", icon="chip",
              sub="从一句口述到一份行动方案，中间经过四段处理，全部在本机完成")

COLS = [
    ("输入", PRIMARY, [("mic", "语音 · Web Speech"), ("chat", "自然语言文本"),
                     ("camera", "化验单照片")]),
    ("抽取与理解", PRIMARY, [("chip", "Qwen3-1.7B + GBNF"),
                        ("layers", "规则兜底：词表 / 修补"),
                        ("terminal", "Agent 工具调用 ≤4 步")]),
    ("计算", RECLAIM, [("tree", "家系结构信号 12 维"),
                     ("calc", "三套风险方程"),
                     ("trend", "可回收：可改 vs 改不了")]),
    ("输出", RECLAIM, [("target", "家系图 · 可回溯原话"),
                     ("balance", "风险百分比 + 分层"),
                     ("flag", "这周就能做的清单")]),
]
col_w, gap = 2.42, 0.52
col_x = [M + i * (col_w + gap) for i in range(len(COLS))]
top = 2.5
box_h, box_gap = 0.62, 0.14

for ci, (name, tone, items) in enumerate(COLS):
    x = col_x[ci]
    # 列标题
    tf = text_box(s, x, 2.06, col_w, 0.3, align=PP_ALIGN.CENTER)
    para(tf, name, size=10.5, bold=True, color=tone, first=True, align=PP_ALIGN.CENTER)
    for bi, (ic, item) in enumerate(items):
        y = top + bi * (box_h + box_gap)
        rect(s, x, y, col_w, box_h, fill=SURFACE, line=LINE2)
        icon_path = os.path.join(ICONS, ic + ".png")
        if os.path.exists(icon_path):
            s.shapes.add_picture(icon_path, Inches(x + 0.12), Inches(y + 0.20),
                                 Inches(0.22), Inches(0.22))
        tf = text_box(s, x + 0.38, y + 0.05, col_w - 0.48, box_h - 0.10,
                      align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.MIDDLE)
        para(tf, item, size=9, color=TEXT, first=True, align=PP_ALIGN.LEFT, line=1.2)
    # 列间箭头
    if ci < len(COLS) - 1:
        ay = top + box_h / 2 + 0.05
        ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + col_w + 0.12), Inches(ay - 0.09),
                                Inches(gap - 0.24), Inches(0.18))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2
        ar.line.fill.background(); ar.shadow.inherit = False

# 底部：本机数据层（服务层与模型层写入）
data_y = top + 3 * (box_h + box_gap) + 0.28
rect(s, col_x[1], data_y, col_w * 2 + gap, 0.6, fill=PRIMARY_SOFT, line=LINE2)
db_icon = os.path.join(ICONS, "db.png")
if os.path.exists(db_icon):
    s.shapes.add_picture(db_icon, Inches(col_x[1] + 0.28), Inches(data_y + 0.17),
                         Inches(0.26), Inches(0.26))
tf = text_box(s, col_x[1] + 0.6, data_y + 0.1, col_w * 2 + gap - 0.75, 0.4)
para(tf, "本机 MySQL：家系 · 体检数字 · 会话（单用户单份，整份覆盖保存）", size=9.5,
     color=TEXT, first=True, align=PP_ALIGN.CENTER)
for cx in (col_x[1] + col_w / 2, col_x[2] + col_w / 2):
    ln = s.shapes.add_connector(1, Inches(cx), Inches(data_y - 0.28), Inches(cx), Inches(data_y))
    ln.line.color.rgb = LINE2; ln.line.width = Pt(1.25)

# 本机边界（虚线框）：模型、计算、存储都在里面
bnd = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(col_x[1] - 0.18), Inches(top - 0.28),
                         Inches(col_w * 3 + gap * 2 + 0.36), Inches(data_y - top + 1.16))
bnd.fill.background()
bnd.line.color.rgb = RECLAIM
bnd.line.width = Pt(1.25)
bnd.line.dash_style = 4  # 虚线
bnd.shadow.inherit = False
# 标签放在框内底部：放顶部会压住「抽取与理解 / 计算 / 输出」三个列标题
rect(s, col_x[1] + 0.9, data_y + 0.56, col_w * 2 + gap - 1.8, 0.28, fill=SURFACE, line=None)
tf = text_box(s, col_x[1], data_y + 0.58, col_w * 2 + gap, 0.24, align=PP_ALIGN.CENTER)
para(tf, "本机边界 · 代码里没有任何外部 API 调用 · 断网可演示", size=9, bold=True,
     color=RECLAIM, first=True, align=PP_ALIGN.CENTER)

tf = text_box(s, M, 6.42, W, 0.4)
para(tf, "模型只负责「口语 → 结构」这一段；风险与可回收是确定性计算，可复算、可审计，换任何模型结论都不变。",
     size=11, color=MUTED, first=True)
footer(s, 7)

# ============ P10 分层技术架构（模块级） ============
s = new_slide(2, "代码怎么组织：五层，每层只依赖下一层",
              icon="layers", sub="路径都是仓库里真实存在的目录；这页回答「你们的架构是什么」")
MONO = "Consolas"

BANDS = [
    ("表现层", "Presentation", "layers",
     ["app/chat · app/risk", "app/cvd · app/lung", "components/pedigree", "components/simulator"],
     "客户端只做展示与交互，判断全在服务端"),
    ("接口层", "API Routes", "terminal",
     ["/api/extract", "/api/extract/stream", "/api/ocr", "/api/agent",
      "/api/decision/*", "/api/me/*"],
     "统一限流 + 入参上限 + 畸形数据拒绝"),
    ("领域层", "Domain", "calc",
     [("lib/extract", "client · grammar · lexicon · repair"),
      ("lib/risk", "findrisc · chinapar · plcom2012"),
      ("lib/decision", "client · hereditary · structural"),
      ("lib/agent", "loop · tools")],
     "纯函数为主，可单测；不含 IO"),
    ("引擎层", "Engines", "chip",
     ["llama :8080 · Qwen3-1.7B + GBNF", "llama :8082 · 视觉", "MySQL :3306", "结构模型 LR 12 维"],
     "全在本机，代码里没有外部 API 调用"),
    ("质控层", "Quality Gate", "target",
     ["scripts/eval-extract.ts", "scripts/lexicon-gaps.ts", "metrics.ts + metrics.test.ts",
      "docs/eval-results/*.json"],
     "留出集只跑一次；数字漂移会让测试失败"),
]

band_x, band_w = 2.30, 8.55
note_x = 11.05
top, band_h, band_gap = 1.98, 0.74, 0.15
tone_of = [PRIMARY, PRIMARY, RECLAIM, RECLAIM, DANGER]

for bi, (cn, en, ic, chips, note) in enumerate(BANDS):
    y = top + bi * (band_h + band_gap)
    tone = tone_of[bi]
    # 左侧层名
    rect(s, M, y, 1.38, band_h, fill=SURFACE, line=LINE2)
    icon_path = os.path.join(ICONS, ic + ".png")
    if os.path.exists(icon_path):
        s.shapes.add_picture(icon_path, Inches(M + 0.12), Inches(y + 0.12), Inches(0.22), Inches(0.22))
    tf = text_box(s, M + 0.38, y + 0.10, 0.92, 0.28)
    para(tf, cn, size=10, bold=True, color=tone, first=True)
    tf = text_box(s, M + 0.10, y + 0.44, 1.20, 0.26)
    para(tf, en, size=7.5, color=FAINT, first=True)

    # 该层的模块块：chip 可以是纯字符串，也可以是 (模块名, 子模块) 两行
    gap = 0.10
    def label_len(c):
        return len(c[0]) + (len(c[1]) if isinstance(c, tuple) else 0)

    widths = [max(1.0, min(3.4, 0.098 * label_len(c) + 0.30)) for c in chips]
    k = (band_w - gap * (len(chips) - 1)) / sum(widths)
    x = band_x
    for ci, c in enumerate(chips):
        w = widths[ci] * k
        rect(s, x, y + 0.10, w, band_h - 0.20, fill=SURFACE, line=LINE2)
        tf = text_box(s, x + 0.08, y + 0.10, w - 0.16, band_h - 0.20,
                      align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        if isinstance(c, tuple):
            para(tf, c[0], size=8, bold=True, color=TEXT, first=True,
                 align=PP_ALIGN.CENTER, line=1.1, latin=MONO)
            para(tf, c[1], size=6.5, color=MUTED, align=PP_ALIGN.CENTER, line=1.1, latin=MONO)
        else:
            para(tf, c, size=7.5, color=TEXT, first=True, align=PP_ALIGN.CENTER, line=1.15, latin=MONO)
        x += w + gap

    # 右侧约束说明
    tf = text_box(s, note_x, y + 0.10, 1.55, band_h - 0.20, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, note, size=8, color=MUTED, first=True, line=1.3)

    # 层间向下箭头（在层名与模块之间的空隙里）
    if bi < len(BANDS) - 1:
        ar = s.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(M + 0.62), Inches(y + band_h + 0.02),
                                Inches(0.14), Inches(band_gap - 0.04))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2
        ar.line.fill.background(); ar.shadow.inherit = False

tf = text_box(s, M, 6.42, W, 0.3)
para(tf, "依赖方向自上而下：上层可换（表现层 / 接口层），下层稳定（领域层纯函数、引擎层确定性）。",
     size=9.5, color=MUTED, first=True)
footer(s, 10)

# ============ P9 部署视图 ============
s = new_slide(2, "部署视图：一台电脑跑完全部，只有公网入口是可选项",
              icon="layers", sub="评委常问的三件事——跑在哪、要不要联网、花多少钱")


def dep_box(x, y, w, h, icon=None, title="", sub="", fill=SURFACE):
    rect(s, x, y, w, h, fill=fill, line=LINE2)
    tx = x + 0.16
    if icon:
        path = os.path.join(ICONS, icon + ".png")
        if os.path.exists(path):
            s.shapes.add_picture(path, Inches(x + 0.14), Inches(y + 0.14), Inches(0.22), Inches(0.22))
            tx = x + 0.44
    tf = text_box(s, tx, y + 0.10, w - (tx - x) - 0.14, 0.3)
    para(tf, title, size=10.5, bold=True, color=TEXT, first=True)
    if sub:
        tf = text_box(s, x + 0.16, y + 0.42, w - 0.30, h - 0.46)
        para(tf, sub, size=9, color=MUTED, first=True, line=1.3)


# 左：用户侧
dep_box(M, 2.35, 2.25, 0.95, "chat", "浏览器 / 手机", "不需要安装客户端")
dep_box(M, 3.55, 2.25, 1.25, "mic", "三种输入", "语音 · 文本 · 拍化验单")

ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(3.10), Inches(2.74), Inches(0.42), Inches(0.22))
ar.fill.solid(); ar.fill.fore_color.rgb = LINE2; ar.line.fill.background(); ar.shadow.inherit = False
tf = text_box(s, 3.02, 2.44, 0.6, 0.24, align=PP_ALIGN.CENTER)
para(tf, "HTTP", size=8, color=FAINT, first=True, align=PP_ALIGN.CENTER)

# 中：一台电脑（虚线边界）
frame = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(3.62), Inches(2.05),
                           Inches(6.55), Inches(4.0))
frame.fill.background()
frame.line.color.rgb = RECLAIM
frame.line.width = Pt(1.25)
frame.line.dash_style = 4
frame.shadow.inherit = False
rect(s, 3.95, 1.96, 2.75, 0.30, fill=RECLAIM_SOFT, line=RECLAIM)
tf = text_box(s, 3.95, 1.99, 2.75, 0.24, align=PP_ALIGN.CENTER)
para(tf, "同一台电脑 · RTX 5080 16 GB", size=9, bold=True, color=RECLAIM, first=True,
     align=PP_ALIGN.CENTER)

dep_box(3.85, 2.50, 6.10, 0.82, "chip", "Next.js 站点 :5173",
        "页面 + API 路由（extract / ocr / agent / decision）")

# 标题写「角色」，端口放说明行：直接写 llama-server :8080 会在 1.9" 的框里折行
for i, (ic, t, sb) in enumerate([("chip", "抽取模型", "llama-server :8080\nQwen3-1.7B + GBNF"),
                                 ("camera", "视觉模型", "llama-server :8082\n化验单识别"),
                                 ("db", "MySQL", ":3306\n家系 · 体检 · 会话")]):
    bx = 3.85 + i * 2.10
    dep_box(bx, 3.78, 1.90, 0.95, ic, t, sb)
    ln = s.shapes.add_connector(1, Inches(bx + 0.95), Inches(3.32), Inches(bx + 0.95), Inches(3.78))
    ln.line.color.rgb = LINE2
    ln.line.width = Pt(1.25)

tf = text_box(s, 3.85, 4.92, 6.10, 0.85)
para(tf, "本机实测：模型启动 1.7 s、单句抽取 0.11 s、显存占用 1.8 GB（RTX 5080）。",
     size=9.5, color=TEXT, first=True, line=1.35)
para(tf, "断网时除「公网入口」外一切正常，包括现场演示。", size=9.5, color=RECLAIM, line=1.35)

# 右：可选的公网入口
dash = s.shapes.add_connector(1, Inches(10.22), Inches(2.90), Inches(10.60), Inches(2.90))
dash.line.color.rgb = FAINT
dash.line.width = Pt(1.25)
dash.line.dash_style = 4
tf = text_box(s, 10.12, 2.60, 0.6, 0.24, align=PP_ALIGN.CENTER)
para(tf, "可选", size=8, color=FAINT, first=True, align=PP_ALIGN.CENTER)

dep_box(10.62, 2.35, 1.95, 0.95, "flag", "VPS", "clear.ysti.com.cn")
dep_box(10.62, 3.55, 1.95, 0.95, "layers", "SSH 反向隧道", "-R 18001 → 5173")
tf = text_box(s, 10.62, 4.62, 1.95, 0.55)
para(tf, "只为让评委用手机打开；不开也能完整演示。", size=8.5, color=FAINT, first=True, line=1.3)

# 底部三条结论
for i, (big, label) in enumerate([("1 台", "实测显存 1.8 GB，单机即可承载全部"),
                                  ("0 元", "每次推理不产生费用"),
                                  ("离线", "断网状态可完整演示")]):
    x = M + i * 3.95
    tf = text_box(s, x, 6.28, 3.6, 0.36)
    rich(tf, [(big + "  ", True, PRIMARY), (label, False, MUTED)], size=11, first=True)
footer(s, 9)

# ============ P8 三引擎 ============
s = new_slide(2, "三套引擎，各管一段，都对齐原始文献", icon="calc")
engines = [
    ("FINDRISC", "糖代谢风险", "年龄 / BMI / 腰围 / 用药 / 家族史",
     [("适用", "成人（年龄计入分值）"),
      ("输出", "0–26 分 · 五档 · 可回收拆分"),
      ("分档线", "≤6 / 7–11 / 12–14 / 15–20 / 21–26")],
     "腰围单独计分，不是 2003 原文的旧版量表"),
    ("China-PAR", "心血管 10 年风险", "血压 / 血脂 / 吸烟 / 糖尿病 / 家族史",
     [("适用", "35–74 岁（越界只提示）"),
      ("输出", "10 年 ASCVD 风险 % + 分层"),
      ("校验", "论文 Table 2 八个验证点")],
     "家族史是独立系数，不是一个「有 / 无」开关"),
    ("PLCOm2012", "肺癌 6 年风险", "吸烟量（包年）/ 戒烟年限 / 家族史",
     [("适用", "55–74 岁验证人群（计算 40–85）"),
      ("输出", "6 年肺癌风险 % + 筛查阈值"),
      ("边界", "只对曾吸烟者建模")],
     "非吸烟者不在建模人群里，直接不给数字"),
]
cw = (W - 0.5) / 3
for i, (name, what, inputs, specs, note) in enumerate(engines):
    x = M + i * (cw + 0.25)
    rect(s, x, 2.05, cw, 3.55, fill=SURFACE, line=LINE)
    rect(s, x, 2.05, cw, 0.06, fill=PRIMARY, radius=False)
    tf = text_box(s, x + 0.28, 2.20, cw - 0.56, 0.36)
    para(tf, name, size=16, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.28, 2.58, cw - 0.56, 0.3)
    para(tf, what, size=12, bold=True, first=True)
    tf = text_box(s, x + 0.28, 2.94, cw - 0.56, 0.72)
    para(tf, "输入：" + inputs, size=9.5, color=MUTED, first=True, line=1.35)

    rect(s, x + 0.28, 3.72, cw - 0.56, 0.012, fill=LINE, radius=False)

    # 规格行：把卡片中段的空白用真实参数填掉，而不是留空
    for j, (label, value) in enumerate(specs):
        y = 3.86 + j * 0.44
        tf = text_box(s, x + 0.28, y, 0.72, 0.26)
        para(tf, label, size=8.5, color=FAINT, first=True)
        tf = text_box(s, x + 0.96, y - 0.03, cw - 1.24, 0.34)
        para(tf, value, size=9.5, color=TEXT, first=True, line=1.25)

    tf = text_box(s, x + 0.28, 5.20, cw - 0.56, 0.36)
    para(tf, note, size=9, color=RECLAIM, first=True, line=1.3)

rect(s, M, 5.80, W, 0.98, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.28, 5.90, W - 0.56, 0.8)
para(tf, "为什么不用云端大模型算风险：确定性计算可复算、可审计，换任何模型结论都不变；模型只负责把口语变成结构。",
     size=11, first=True, line=1.35)
para(tf, "系数逐项登记在 docs/references.md；越界只提示不拒绝，落在建模人群之外（如非吸烟者）时直接不给数字。",
     size=11, color=MUTED, line=1.35)
footer(s, 12)

# ============ P9 准确性 ============
s = new_slide(3, "口语抽取：留出集 F1 从 0.877 到 1.000", icon="target",
              sub="每套留出集都是全新措辞、只跑一次；跑过即降级为开发集，不再对外报数")
f1_chart(s, M - 0.1, 1.95, 7.25, 4.05,
         [0.877, 0.868, 0.912, 0.966, 1.000 - 0.018, 1.000],
         ["v2", "v3", "v5", "v7", "v8", "v9"],
         ["规则修补\n称谓/续句", "词表\n系统补齐", "规则兜底\n+ few-shot",
          "支架/血压\n续句用原话", "血糖/心脏\n别名变体", "裸「支架」\n入表"])

tf = text_box(s, M, 6.02, 7.1, 0.4)
para(tf, "每一跳都对应一次具体改动，没有一次是「换个更大的模型」。", size=10.5,
     bold=True, color=RECLAIM, first=True)

# 右栏：一把抓住的四个数 + 每套留出集的真实构成（构建时现算）
tf = text_box(s, 8.15, 1.92, 4.35, 0.3)
rich(tf, [("6", True, PRIMARY), (" 套 · ", False, MUTED), ("180", True, PRIMARY),
          (" 条 · ", False, MUTED), ("F1 1.000", True, RECLAIM),
          (" · ", False, FAINT), ("±10%", True, DANGER)], size=13, first=True)

rows, tot = holdout_stats()
tbl = s.shapes.add_table(len(rows) + 1, 6, Inches(8.15), Inches(2.34),
                         Inches(4.35), Inches(0.4 * (len(rows) + 1))).table
for j, wd in enumerate([0.62, 0.82, 0.72, 0.7, 0.7, 0.7]):
    tbl.columns[j].width = Inches(wd)
heads = ["集", "字数", "亲属", "年龄", "否定", "续句"]
for j, h in enumerate(heads):
    cell = tbl.cell(0, j); cell.text = ""
    para(cell.text_frame, h, size=8, bold=True, color=MUTED, first=True,
         align=PP_ALIGN.CENTER)
    cell.fill.solid(); cell.fill.fore_color.rgb = PRIMARY_SOFT
for i, (tag, n, chars, rels, age, neg, cont, multi) in enumerate(rows, start=1):
    vals = [tag, f"{chars}", f"{rels}", str(age), str(neg), str(cont)]
    for j, v in enumerate(vals):
        cell = tbl.cell(i, j); cell.text = ""
        para(cell.text_frame, v, size=8.5, bold=(j == 0),
             color=TEXT if j else PRIMARY, first=True, align=PP_ALIGN.CENTER)
        cell.fill.solid(); cell.fill.fore_color.rgb = SURFACE
for row in tbl.rows:
    row.height = Inches(0.34)
    for cell in row.cells:
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_top = Inches(0.01); cell.margin_bottom = Inches(0.01)

tf = text_box(s, 8.15, 4.92, 4.35, 0.9)
para(tf, f"六套合计 180 条：含年龄 {tot[1]}、否定句 {tot[2]}、续句 {tot[3]}、多人句 {tot[4]}。",
     size=9, color=MUTED, first=True, line=1.35)
para(tf, "不是同一模板换词——每套都独立覆盖了否定、续句与多人场景。", size=9, color=MUTED, line=1.35)

rect(s, M, 6.42, W, 0.42, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.24, 6.47, W - 0.48, 0.3)
para(tf, "机制：留出集只跑一次 · 每次评测自动落盘（commit + 模型 + 逐条预测）· 页面数字由 metrics.ts 单一来源提供",
     size=9.5, color=TEXT, first=True)
footer(s, 11)

# ============ P10 判定选型 ============
s = new_slide(3, "遗传模式判定：为什么最后没用大模型做这件事", icon="balance")
rows = [
    ("OpenJev-Q4（18.5 GB，通用决策模型）", "40%", "6.3 s", "隐性 / X 连锁 / 线粒体 三类全错"),
    ("结构逻辑回归（12 维特征，2.3 KB）", "96%", "< 0.1 s", "同一批均衡样本，每类 5 条"),
]
tbl = s.shapes.add_table(len(rows) + 1, 4, Inches(M), Inches(2.15), Inches(W), Inches(1.7)).table
for j, wd in enumerate([4.9, 1.4, 1.5, 3.9]):
    tbl.columns[j].width = Inches(wd)
for j, h in enumerate(["方案", "准确率", "单次延迟", "说明"]):
    cell = tbl.cell(0, j); cell.text = ""
    r = cell.text_frame.paragraphs[0].add_run(); r.text = h
    set_font(r, 11, True, MUTED)
    cell.fill.solid(); cell.fill.fore_color.rgb = PRIMARY_SOFT
for i, row in enumerate(rows, start=1):
    for j, val in enumerate(row):
        cell = tbl.cell(i, j); cell.text = ""
        r = cell.text_frame.paragraphs[0].add_run(); r.text = val
        set_font(r, 11.5, j == 1, TEXT if j != 3 else MUTED)
        cell.fill.solid(); cell.fill.fore_color.rgb = SURFACE
for row in tbl.rows:
    row.height = Inches(0.5)
    for cell in row.cells:
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.14)
        cell.margin_right = Inches(0.1)

tf = text_box(s, M, 4.15, W, 1.1)
para(tf, "结论：输出空间被 GBNF + 词表 + few-shot 收得很窄，问题不在模型容量，而在「家系结构本身就能判」。",
     size=12.5, bold=True, first=True, line=1.45)
para(tf, "默认后端换成结构模型（毫秒级、无需 18 GB 权重）；OpenJev 保留为可切换的对照后端。协议层照 TypeSafe /v1/systemone 实现，换官方 API 只改一个环境变量。",
     size=11, color=MUTED, line=1.45)

rect(s, M, 5.45, W, 1.05, fill=SURFACE, line=LINE)
tf = text_box(s, M + 0.28, 5.56, W - 0.56, 0.85)
para(tf, "产品里的样子：模型给出五种模式的概率 → 最高项达门槛才显示结论；不达门槛退回「证据不足」，",
     size=11, first=True, line=1.35)
para(tf, "并列出缺什么让用户补一句（例如「母系亲属是否患病」），而不是硬给一个模式。", size=11, line=1.35)
footer(s, 10)

# ============ P11 微调 A/B ============
s = new_slide(3, "我们真的微调了一次，然后被数据否掉", icon="flask")
rows = [
    ("基线 + few-shot + 规则层", "1.000", "0.893", "0.943", "27/30"),
    ("微调 + 规则层", "1.000", "0.893", "0.943", "27/30"),
    ("基线模型原始能力（跳过规则层）", "0.957", "0.786", "0.863", "23/30"),
    ("微调模型原始能力（跳过规则层）", "0.957", "0.786", "0.863", "23/30"),
]
tbl = s.shapes.add_table(len(rows) + 1, 5, Inches(M), Inches(2.15), Inches(W), Inches(2.0)).table
for j, wd in enumerate([5.5, 1.6, 1.6, 1.6, 1.5]):
    tbl.columns[j].width = Inches(wd)
for j, h in enumerate(["配置（封存留出集 30 条，从未参与训练）", "Precision", "Recall", "F1", "完全匹配"]):
    cell = tbl.cell(0, j); cell.text = ""
    r = cell.text_frame.paragraphs[0].add_run(); r.text = h
    set_font(r, 10.5, True, MUTED)
    cell.fill.solid(); cell.fill.fore_color.rgb = PRIMARY_SOFT
for i, row in enumerate(rows, start=1):
    for j, val in enumerate(row):
        cell = tbl.cell(i, j); cell.text = ""
        r = cell.text_frame.paragraphs[0].add_run(); r.text = val
        set_font(r, 11, j == 3, TEXT)
        cell.fill.solid(); cell.fill.fore_color.rgb = SURFACE
for row in tbl.rows:
    row.height = Inches(0.46)
    for cell in row.cells:
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.14)

rect(s, M, 4.5, W, 1.7, fill=RECLAIM_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 4.62, W - 0.6, 1.45)
para(tf, "逐条比对 30 条输出：模型层只有 2 条不同，指标完全一致；叠加规则层后 30/30 完全相同。",
     size=12, first=True, line=1.4)
para(tf, "处置：不引入微调模型，省下 1.1 GB 权重与一套维护。训练链路保留（1355 条 / 3 epoch / 21 分钟 / merge → GGUF → Q4）。",
     size=11, color=MUTED, line=1.4)
para(tf, "负结果也是结果：它证明提升空间在词表与规则，而不在参数量。", size=11, color=RECLAIM, line=1.4)
footer(s, 11)

# ============ P12 隐私与合规 ============
s = new_slide(4, "隐私与合规：写进代码的承诺", icon="lock")
left = [
    ("100% 本机推理", "llama-server 跑在 127.0.0.1；代码里没有任何外部 API 调用"),
    ("数据不出机器", "家系与体检数字存在本机 MySQL；化验单图片只在内存里转 base64"),
    ("不宣称诊断", "遗传模式等判断统一写「提示，不是诊断」，并显示置信度"),
    ("不确定就不显示", "置信度不足时退回「证据不足」并给出缺口追问，而不是硬给结论"),
]
for i, (h1, h2) in enumerate(left):
    y = 2.15 + i * 1.1
    tf = text_box(s, M, y, 6.5, 0.32)
    para(tf, h1, size=13.5, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, M, y + 0.32, 6.5, 0.65)
    para(tf, h2, size=10.5, color=MUTED, first=True, line=1.35)

rect(s, 7.6, 2.1, 4.95, 3.75, fill=SURFACE, line=LINE)
tf = text_box(s, 7.85, 2.22, 4.45, 0.35)
para(tf, "我们不做的事", size=12.5, bold=True, color=DANGER, first=True)
tf = text_box(s, 7.85, 2.65, 4.45, 3.1)
for i, line in enumerate(["不埋点统计用户病史", "不上传任何图片或文本", "不给出用药建议",
                          "不把风险说成「预测你会得病」", "不在界面上出现查不到出处的数字"]):
    para(tf, "· " + line, size=11, first=(i == 0), line=1.6)
footer(s, 12)

# ============ P13 差异化 ============
s = new_slide(4, "同一件事，四种现有做法各自缺一环", icon="layers",
              sub="对照的是典型形态，不针对某一款具体产品")
COLSX = ["体检解读 App", "医院问卷", "临床家系图", "通用健康 App", "家系"]
ROWS = [
    ("看家族史", ["✕", "△", "✓", "△", "✓"]),
    ("记发病年龄", ["✕", "✕", "✓", "✕", "✓"]),
    ("结果可复算", ["✕", "✕", "△", "✕", "✓"]),
    ("每条可回查原话", ["✕", "✕", "✕", "✕", "✓"]),
    ("拆出「可回收」", ["✕", "✕", "✕", "✕", "✓"]),
    ("数据不出机器", ["✕", "✓", "✓", "✕", "✓"]),
]
ncol = len(COLSX)
label_w = 2.35
col_w = (W - label_w) / ncol
top = 2.05
row_h = 0.52
tbl = s.shapes.add_table(len(ROWS) + 1, ncol + 1, Inches(M), Inches(top),
                         Inches(W), Inches(row_h * (len(ROWS) + 1))).table
tbl.columns[0].width = Inches(label_w)
for j in range(1, ncol + 1):
    tbl.columns[j].width = Inches(col_w)
head = [" "] + COLSX
for j, h in enumerate(head):
    cell = tbl.cell(0, j); cell.text = ""
    last = j == ncol
    para(cell.text_frame, h, size=9.5, bold=True,
         color=PRIMARY if last else MUTED, first=True, align=PP_ALIGN.CENTER)
    cell.fill.solid()
    cell.fill.fore_color.rgb = PRIMARY_SOFT if last else SURFACE
for i, (label, marks) in enumerate(ROWS, start=1):
    cell = tbl.cell(i, 0); cell.text = ""
    para(cell.text_frame, label, size=9.5, color=TEXT, first=True)
    cell.fill.solid(); cell.fill.fore_color.rgb = SURFACE
    for j, mk in enumerate(marks, start=1):
        cell = tbl.cell(i, j); cell.text = ""
        # ✕ 原来太淡（投影下看不见），改成 FAINT 级灰；△ 用 MUTED，✓ 用墨绿
        color = RECLAIM if mk == "✓" else (MUTED if mk == "△" else FAINT)
        para(cell.text_frame, mk, size=12, bold=(mk == "✓"), color=color, first=True,
             align=PP_ALIGN.CENTER)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RECLAIM_SOFT if j == ncol else SURFACE
for row in tbl.rows:
    row.height = Inches(row_h)
    for cell in row.cells:
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.10); cell.margin_right = Inches(0.06)

tf = text_box(s, M, 6.28, 7.6, 0.3)
para(tf, "✓ 具备　△ 部分具备　✕ 不具备", size=8.5, color=FAINT, first=True)
rect(s, 8.55, 6.22, 4.2, 0.42, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, 8.72, 6.28, 3.9, 0.3)
para(tf, "我们的四件事，都落在这张表的最后一列", size=9.5, bold=True, color=PRIMARY, first=True)
footer(s, 17)

# ============ P18 价值与落地（实测数字） ============
s = new_slide(4, "落地：一台电脑跑完整个闭环，数字都是实测的", icon="trend",
              sub="以下体积与耗时在本机实测（RTX 5080 / 32 GB 内存），不是估算")
rect(s, M, 2.02, 6.55, 3.45, fill=SURFACE, line=LINE)
tf = text_box(s, M + 0.28, 2.14, 6.0, 0.3)
para(tf, "要装什么（体积）", size=10.5, bold=True, color=PRIMARY, first=True)
items = [
    ("抽取模型 Qwen3-1.7B · Q4_K_M", "1.2 GB"),
    ("llama.cpp 运行时（CUDA 构建）", "202 MB"),
    ("视觉模型 + mmproj（可选）", "2.6 GB"),
    ("站点构建产物 .next", "120 MB"),
    ("依赖 node_modules", "419 MB"),
]
for i, (name, size) in enumerate(items):
    y = 2.52 + i * 0.56
    tf = text_box(s, M + 0.28, y, 4.5, 0.3)
    para(tf, name, size=9.5, color=TEXT, first=True)
    tf = text_box(s, 5.55, y, 1.05, 0.3, align=PP_ALIGN.RIGHT)
    para(tf, size, size=10, bold=True, color=PRIMARY, first=True, align=PP_ALIGN.RIGHT)
    if i < len(items) - 1:
        rect(s, M + 0.28, y + 0.40, 6.0, 0.008, fill=LINE, radius=False)

tf = text_box(s, 7.65, 2.02, 4.9, 0.3)
para(tf, "要等多久（实测）", size=10.5, bold=True, color=PRIMARY, first=True)
metrics = [("1.7", " 秒", "模型服务启动到首个可用响应"),
           ("0.11", " 秒", "单句家族史抽取（含 GBNF 约束）"),
           ("1.8", " GB", "模型推理的显存占用"),
           ("< 1", " 毫秒", "三套风险方程（纯本地函数）")]
for i, (big, unit, label) in enumerate(metrics):
    y = 2.42 + i * 0.76
    rect(s, 7.65, y, 4.9, 0.66, fill=SURFACE, line=LINE)
    tf = text_box(s, 7.85, y + 0.10, 1.5, 0.4)
    rich(tf, [(big, True, PRIMARY), (unit, False, PRIMARY)], size=17, first=True)
    tf = text_box(s, 9.35, y + 0.10, 3.05, 0.5)
    para(tf, label, size=9.5, color=MUTED, first=True, line=1.25)

rect(s, M, 5.62, W, 1.05, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 5.72, W - 0.6, 0.9)
para(tf, "成本：推理全在本机，没有按次计费、没有额度限制；整套演示环境约 4.5 GB 磁盘，一台机器即可承载。",
     size=11, first=True, line=1.35)
para(tf, "口径：本机实测（RTX 5080 / GPU 推理，多次取中位）；换普通 CPU 也能跑，只是抽取约慢一个数量级。",
     size=9.5, color=MUTED, line=1.35)
footer(s, 18)

# ============ P15 团队 ============
s = new_slide(5, "团队：谁在负责哪一块", icon="team",
              sub="【待填】请补充成员姓名、学校 / 单位、分工与代表成果")
members = [("【成员 1】", "【角色】", "【负责模块】"), ("【成员 2】", "【角色】", "【负责模块】"),
           ("【成员 3】", "【角色】", "【负责模块】")]
cw = (W - 0.5) / 3
for i, (name, role, what) in enumerate(members):
    x = M + i * (cw + 0.25)
    rect(s, x, 2.2, cw, 2.6, fill=SURFACE, line=LINE)
    av = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + cw / 2 - 0.45), Inches(2.42), Inches(0.9), Inches(0.9))
    av.fill.solid(); av.fill.fore_color.rgb = PRIMARY_SOFT; av.line.color.rgb = LINE2; av.shadow.inherit = False
    tf = text_box(s, x + 0.2, 3.45, cw - 0.4, 0.35, align=PP_ALIGN.CENTER)
    para(tf, name, size=13, bold=True, first=True, align=PP_ALIGN.CENTER)
    tf = text_box(s, x + 0.2, 3.8, cw - 0.4, 0.3, align=PP_ALIGN.CENTER)
    para(tf, role, size=10.5, color=PRIMARY, first=True, align=PP_ALIGN.CENTER)
    tf = text_box(s, x + 0.2, 4.12, cw - 0.4, 0.55, align=PP_ALIGN.CENTER)
    para(tf, what, size=10, color=MUTED, first=True, align=PP_ALIGN.CENTER, line=1.35)

tf = text_box(s, M, 5.15, W, 0.85)
para(tf, "【待填】一句话团队介绍：为什么是我们——例如医学背景 + 前端工程 + 本地模型部署的组合。",
     size=11.5, color=MUTED, first=True, line=1.45)
footer(s, 15)

# ============ P17 结尾（与封面呼应：深色背景） ============
s = prs.slides.add_slide(BLANK)
s.shapes.add_picture(art_path("content-bg-plain"), 0, 0,
                     width=prs.slide_width, height=prs.slide_height)
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
tf = text_box(s, M, 1.75, 10, 0.36)
para(tf, "家  系　Pedigree", size=12.5, bold=True, color=PRIMARY, first=True)
tf = text_box(s, M, 2.15, 10.9, 1.1)
para(tf, "把家族史从一句话，变成能算、能改、能复算的东西", size=30, bold=True,
     color=TEXT, first=True, line=1.25)
tf = text_box(s, M, 3.35, 10, 0.45)
para(tf, "谢谢聆听 · 欢迎提问", size=14, color=MUTED, first=True)
rect(s, M, 3.95, 1.5, 0.05, fill=PRIMARY, radius=False)
tf = text_box(s, M, 4.20, 11, 0.9)
para(tf, "现场可演示：口述家族史 → 家系图 → 三套风险 → 可回收建议（全程本机，断网可用）",
     size=11, color=MUTED, first=True, line=1.5)
para(tf, "代码与评测产物：留出集 6 套、每套 30 条，docs/eval-results 可逐条复核",
     size=11, color=MUTED, line=1.5)

# 收尾的四件事，用图标条代替空话
closing = [("tree", "家系图", "口述即可生成"), ("chip", "本机推理", "抽取 0.11 秒"),
           ("lock", "数据不出机器", "无外部 API"), ("flag", "可执行的下一步", "这周就能做")]
cw2 = (W - 0.45) / 4
for i, (ic, title, note) in enumerate(closing):
    x = M + i * (cw2 + 0.15)
    rect(s, x, 5.30, cw2, 1.15, fill=SURFACE, line=LINE)
    s.shapes.add_picture(os.path.join(ICONS, ic + ".png"), Inches(x + 0.22),
                         Inches(5.48), Inches(0.34), Inches(0.34))
    tf = text_box(s, x + 0.66, 5.44, cw2 - 0.86, 0.32)
    para(tf, title, size=11.5, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.66, 5.76, cw2 - 0.86, 0.3)
    para(tf, note, size=9.5, color=MUTED, first=True)


# ---------------- 动画与切换 ----------------
def _ns(tag):
    return "{http://schemas.openxmlformats.org/presentationml/2006/main}" + tag


def add_transition(slide, kind="fade"):
    """页面切换：淡入。放在 clrMapOvr 之后、timing 之前（schema 顺序）。"""
    from lxml import etree
    sld = slide._element
    for old in sld.findall(_ns("transition")):
        sld.remove(old)
    t = etree.SubElement(sld, _ns("transition"))
    t.set("advClick", "1")
    etree.SubElement(t, _ns(kind))


def add_entrance(slide, groups, dur=400):
    """给 shape id 分组加「淡入」进入动画。

    groups: [[id, id], [id], ...] —— 第一组随页面自动播放，其余每点一次出一组。
    结构（par → par → par → set + animEffect）与 PowerPoint 自己写出的一致；
    delay="indefinite" 的那组就是「等一次点击」。
    """
    from lxml import etree
    sld = slide._element
    for old in sld.findall(_ns("timing")):
        sld.remove(old)

    A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
    nid = [1]

    def cid():
        nid[0] += 1
        return str(nid[0])

    timing = etree.SubElement(sld, P + "timing")
    tnLst = etree.SubElement(timing, P + "tnLst")
    par0 = etree.SubElement(tnLst, P + "par")
    ctn0 = etree.SubElement(par0, P + "cTn")
    ctn0.set("id", cid()); ctn0.set("dur", "indefinite")
    ctn0.set("restart", "never"); ctn0.set("nodeType", "tmRoot")
    child0 = etree.SubElement(ctn0, P + "childTnLst")
    seq = etree.SubElement(child0, P + "seq")
    seq.set("concurrent", "1"); seq.set("nextAc", "seek")
    ctnSeq = etree.SubElement(seq, P + "cTn")
    ctnSeq.set("id", cid()); ctnSeq.set("dur", "indefinite"); ctnSeq.set("nodeType", "mainSeq")
    seqChild = etree.SubElement(ctnSeq, P + "childTnLst")

    for gi, ids in enumerate(groups):
        outer = etree.SubElement(seqChild, P + "par")
        ctnOuter = etree.SubElement(outer, P + "cTn")
        ctnOuter.set("id", cid()); ctnOuter.set("fill", "hold")
        stOuter = etree.SubElement(ctnOuter, P + "stCondLst")
        condOuter = etree.SubElement(stOuter, P + "cond")
        condOuter.set("delay", "0" if gi == 0 else "indefinite")

        mid = etree.SubElement(ctnOuter, P + "childTnLst")
        parMid = etree.SubElement(mid, P + "par")
        ctnMid = etree.SubElement(parMid, P + "cTn")
        ctnMid.set("id", cid()); ctnMid.set("fill", "hold")
        stMid = etree.SubElement(ctnMid, P + "stCondLst")
        etree.SubElement(stMid, P + "cond").set("delay", "0")

        leafHost = etree.SubElement(ctnMid, P + "childTnLst")
        for spid in ids:
            parLeaf = etree.SubElement(leafHost, P + "par")
            ctnLeaf = etree.SubElement(parLeaf, P + "cTn")
            ctnLeaf.set("id", cid())
            ctnLeaf.set("presetID", "10")        # 10 = Fade
            ctnLeaf.set("presetClass", "entr")
            ctnLeaf.set("presetSubtype", "0")
            ctnLeaf.set("fill", "hold")
            ctnLeaf.set("grpId", "0")
            ctnLeaf.set("nodeType", "afterEffect" if gi == 0 else "clickEffect")
            stLeaf = etree.SubElement(ctnLeaf, P + "stCondLst")
            etree.SubElement(stLeaf, P + "cond").set("delay", "0")

            leafKids = etree.SubElement(ctnLeaf, P + "childTnLst")

            # 1) 只置「可见」，绝不预先设 opacity=0
            #    上一版把 opacity 置 0 再淡入，结果淡入没生效时整页停在全透明——
            #    放映时看起来就是「一片空白」。visibility 即使动画失效也无害。
            setEl = etree.SubElement(leafKids, P + "set")
            cBhvr = etree.SubElement(setEl, P + "cBhvr")
            ctnSet = etree.SubElement(cBhvr, P + "cTn")
            ctnSet.set("id", cid()); ctnSet.set("dur", "1"); ctnSet.set("fill", "hold")
            stSet = etree.SubElement(ctnSet, P + "stCondLst")
            etree.SubElement(stSet, P + "cond").set("delay", "0")
            tgt = etree.SubElement(cBhvr, P + "tgtEl")
            spTgt = etree.SubElement(tgt, P + "spTgt")
            spTgt.set("spid", str(spid))
            attrs = etree.SubElement(cBhvr, P + "attrNameLst")
            etree.SubElement(attrs, P + "attrName").text = "style.visibility"
            to = etree.SubElement(setEl, P + "to")
            etree.SubElement(to, P + "strVal").set("val", "visible")

            # 2) 淡入
            eff = etree.SubElement(leafKids, P + "animEffect")
            eff.set("transition", "in"); eff.set("filter", "fade")
            cb2 = etree.SubElement(eff, P + "cBhvr")
            ctn2 = etree.SubElement(cb2, P + "cTn")
            ctn2.set("id", cid()); ctn2.set("dur", str(dur)); ctn2.set("fill", "hold")
            st2 = etree.SubElement(ctn2, P + "stCondLst")
            etree.SubElement(st2, P + "cond").set("delay", "0")
            tgt2 = etree.SubElement(cb2, P + "tgtEl")
            etree.SubElement(tgt2, P + "spTgt").set("spid", str(spid))

    prev = etree.SubElement(seq, P + "prevCondLst")
    c1 = etree.SubElement(prev, P + "cond")
    c1.set("evt", "onPrev"); c1.set("delay", "0")
    etree.SubElement(etree.SubElement(c1, P + "tgtEl"), P + "sldTgt")
    nxt = etree.SubElement(seq, P + "nextCondLst")
    c2 = etree.SubElement(nxt, P + "cond")
    c2.set("evt", "onNext"); c2.set("delay", "0")
    etree.SubElement(etree.SubElement(c2, P + "tgtEl"), P + "sldTgt")


def animate_all(presentation, max_groups=3):
    """内容形状按「上到下、左到右」排序后分成最多 max_groups 组：

    第 1 组随页面自动出现（标题 + 副标题），其余每组一次点击。
    一页最多按两次 —— 8~10 分钟的答辩不该把时间花在按空格上。
    """
    # entrance 已在真机 PowerPoint 放映中验证通过（2026-11）；
    # 若要退回到「只切页」，设 DECK_ANIM=transitions。
    mode = os.environ.get("DECK_ANIM", "entrance")
    for idx, slide in enumerate(presentation.slides):
        add_transition(slide, "fade")
        if mode != "entrance":
            continue
        picked = []
        for shp in slide.shapes:
            try:
                top = shp.top / 914400.0
                w = shp.width / 914400.0
                h = shp.height / 914400.0
            except TypeError:
                continue
            if top < 0.95:          # 顶部导航条与左侧主色条
                continue
            if w > 13.0 or h > 7.0:  # 整屏背景
                continue
            if w * h < 0.15:        # 分隔细线
                continue
            picked.append(((shp.top, shp.left), shp.shape_id))
        picked.sort(key=lambda t: t[0])
        ids = [i for _, i in picked]
        k = min(max_groups, len(ids))
        if k == 0:
            continue
        size = -(-len(ids) // k)          # ceil，保证组数不超过 k
        groups = [ids[i:i + size] for i in range(0, len(ids), size)]
        add_entrance(slide, groups)


animate_all(prs)


def flatten(presentation):
    from lxml import etree
    A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
    for slide in presentation.slides:
        for shp in slide.shapes:
            el = getattr(shp, "_element", None)
            if el is None:
                continue
            for style in el.findall(P + "style"):
                el.remove(style)
            spPr = el.find(".//" + A + "spPr")
            if spPr is None:
                continue
            for old in spPr.findall(A + "effectLst"):
                spPr.remove(old)
            etree.SubElement(spPr, A + "effectLst")


NOTES = [
    "开场 15 秒：家系做什么、为谁做。作品编号等待填。",
    "目录：六个问题，一条主线。讲的时候不用逐条念，指一下结构即可。",
    "痛点三层 + 右边给出关键论据：家族史在三套引擎里都有权重（FINDRISC 占 5/26 分）。",
    "四步闭环，强调每一步都能复核。",
    "第一屏演示：一段话 -> 家系图。若现场能跑，直接演示，不用截图。",
    "第二屏：可回收风险把可改与改不了分账；China-PAR 实时重算。",
    "现场动线：说一句 -> 点节点 -> 改一项 -> 看结论，两分半钟；卡住就翻截图页，别现场调试。",
    "四层架构：模型只做把口语变成结构这一件事。",
    "分层架构：五层，每层只依赖下一层；路径都是仓库里真实目录，被问到可以当场打开。",
    "部署视图：一台电脑跑完全部；只有公网入口是可选的，断网也能完整演示。",
    "三套引擎各管一段，都对齐原始文献。",
    "准确性：六套留出集只跑一次，F1 0.877 -> 1.000；同时说明 ±10% 的置信区间。",
    "判定选型：同一批样本 40% vs 96%，说明问题不在模型容量。",
    "方法论：微调做了、A/B 否掉，所以不引入。负结果也是结果。",
    "隐私合规：本机、不落盘、不诊断、不确定不显示。",
    "差异化：四类现有方案各自缺什么。",
    "落地价值：0 元推理成本、单机部署、三类场景。",
    "团队：待填成员信息。",
    "结尾：留时间提问，主动提出可现场演示。",
]
for i, slide in enumerate(prs.slides):
    tf = FOOTERS.get(id(slide))
    if tf is not None:
        tf.paragraphs[0].runs[0].text = f"{i + 1:02d}"
    if i < len(NOTES):
        slide.notes_slide.notes_text_frame.text = NOTES[i]

flatten(prs)
# 输出名可用环境变量覆盖：PowerPoint 打开着目标文件时无法写入
out = os.path.join(CWD, "deliverables", os.environ.get("DECK_OUT", "家系-答辩-v2.pptx"))
os.makedirs(os.path.dirname(out), exist_ok=True)
prs.save(out)
print("已生成:", out, "| 页数:", len(prs.slides._sldIdLst))
