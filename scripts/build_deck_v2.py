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

NAV = ["项目背景", "方案与产品", "技术路线", "准确性与选型", "价值与落地", "团队"]

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
M = 0.78
W = 13.333 - 2 * M


def set_font(run, size=14, bold=False, color=TEXT):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.color.rgb = color
    f.name = EA
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
         space_before=0, align=None):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    if align is not None:
        p.alignment = align
    p.space_before = Pt(space_before)
    if line:
        p.line_spacing = line
    r = p.add_run()
    r.text = text
    set_font(r, size, bold, color)
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


def new_slide(section, title, sub=None):
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, 13.333, 7.5, fill=BG, radius=False)
    rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
    nav_bar(s, section)
    tf = text_box(s, M, 1.02, W, 0.62)
    para(tf, title, size=26, bold=True, first=True)
    if sub:
        tf = text_box(s, M, 1.62, W, 0.4)
        para(tf, sub, size=12.5, color=MUTED, first=True)
    return s


def footer(slide, idx):
    tf = text_box(slide, M, 6.98, 8, 0.28)
    para(tf, "家系 · 家族健康风险量化", size=9, color=FAINT, first=True)
    tf = text_box(slide, 13.333 - M - 1.2, 6.98, 1.2, 0.28, align=PP_ALIGN.RIGHT)
    para(tf, f"{idx:02d}", size=9, color=FAINT, first=True, align=PP_ALIGN.RIGHT)


def stat_card(slide, x, y, w, h, big, unit, label, color=PRIMARY):
    rect(slide, x, y, w, h, fill=SURFACE, line=LINE)
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


# ============ P1 封面 ============
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, 13.333, 7.5, fill=BG, radius=False)
circ = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(9.2), Inches(-1.9), Inches(5.6), Inches(5.6))
circ.fill.solid(); circ.fill.fore_color.rgb = PRIMARY_SOFT; circ.line.fill.background(); circ.shadow.inherit = False
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)

tf = text_box(s, M, 1.25, 7.4, 0.4)
para(tf, "AI + Web / AI 与健康", size=12.5, bold=True, color=PRIMARY, first=True)
tf = text_box(s, M, 1.72, 7.4, 1.15)
para(tf, "家 系", size=60, bold=True, first=True)
tf = text_box(s, M, 2.95, 7.2, 1.3)
para(tf, "把家族口述的病史，整理成一张家系图", size=20, first=True)
para(tf, "并算出你的风险里，有多少是「能拿回来的」", size=20)

rect(s, M, 4.62, 1.5, 0.05, fill=PRIMARY, radius=False)
tf = text_box(s, M, 4.85, 7.2, 1.1)
para(tf, "FINDRISC · China-PAR · PLCOm2012   |   100% 本机推理   |   口语留出集 F1 1.000",
     size=11, color=MUTED, first=True, line=1.5)

info = [("作品编号", "【待填】"), ("省份", "【待填】"), ("团队", "【待填】")]
for i, (k, v) in enumerate(info):
    x = M + i * 2.45
    rect(s, x, 5.95, 2.25, 0.62, fill=SURFACE, line=LINE2)
    tf = text_box(s, x + 0.18, 5.99, 1.95, 0.24)
    para(tf, k, size=8.5, color=FAINT, first=True)
    tf = text_box(s, x + 0.18, 6.22, 1.95, 0.28)
    para(tf, v, size=11.5, bold=True, first=True)

rect(s, 8.55, 1.85, 4.1, 3.3, fill=SURFACE, line=LINE)
picture_fit(s, os.path.join(SHOTS, "02-chat.png"), 8.67, 1.97, 3.86, 3.06)
tf = text_box(s, 8.55, 5.28, 4.1, 0.3, align=PP_ALIGN.CENTER)
para(tf, "口述 → 家系图 → 风险 → 可回收", size=9.5, color=FAINT, first=True, align=PP_ALIGN.CENTER)

# ============ P2 目录 ============
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, 13.333, 7.5, fill=BG, radius=False)
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
tf = text_box(s, M, 1.1, 6, 0.5)
para(tf, "目录  CONTENTS", size=12, bold=True, color=PRIMARY, first=True)
tf = text_box(s, M, 1.55, 8, 0.7)
para(tf, "六个问题，一条主线", size=30, bold=True, first=True)

toc = [
    ("01", "项目背景", "家族史是免费的风险信号，却几乎没人用"),
    ("02", "方案与产品", "口述进、行动出；两屏演示完整闭环"),
    ("03", "技术路线", "四层架构：模型只做它不可替代的一件事"),
    ("04", "准确性与选型", "留出集 F1 1.000；判定为什么不用大模型"),
    ("05", "价值与落地", "差异化、部署成本与落地场景"),
    ("06", "团队", "我们是谁，各自负责什么"),
]
for i, (num, name, desc) in enumerate(toc):
    col = i % 2
    row = i // 2
    x = M + col * 5.95
    y = 2.55 + row * 1.4
    tf = text_box(s, x, y, 0.6, 0.35)
    para(tf, num, size=13, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.62, y - 0.06, 4.9, 0.4)
    para(tf, name, size=17, bold=True, first=True)
    tf = text_box(s, x + 0.62, y + 0.38, 4.9, 0.4)
    para(tf, desc, size=10.5, color=MUTED, first=True)
footer(s, 2)

# ============ P3 项目背景 ============
s = new_slide(0, "家族史是免费的风险信号，三套引擎都给它留了权重",
              "但用户手上的体检报告，从来没有家系图")
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

rect(s, 7.9, 2.1, 4.65, 1.75, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, 8.15, 2.24, 4.15, 1.5)
para(tf, "家族史在引擎里的分量", size=11, bold=True, color=PRIMARY, first=True)
rich(tf, [("FINDRISC：家族史记 ", False, TEXT), ("5 / 26", True, DANGER), (" 分", False, TEXT)],
     size=12.5, line=1.5)
rich(tf, [("China-PAR：家族史是", False, TEXT), ("独立系数", True, DANGER), ("，不是开关", False, TEXT)],
     size=12.5, line=1.5)
rich(tf, [("PLCOm2012：家族史是", False, TEXT), ("肺癌方程的一项", True, DANGER)],
     size=12.5, line=1.5)

rect(s, 7.9, 4.12, 4.65, 1.95, fill=SURFACE, line=LINE)
tf = text_box(s, 8.15, 4.26, 4.15, 1.7)
para(tf, "一句真实的话", size=11, bold=True, color=FAINT, first=True)
para(tf, "「我爸 52 岁放了支架，爷爷糖尿病，外公是脑溢血走的。」", size=12, first=False, line=1.5)
para(tf, "这三条，任何体检 App 都不会问。", size=11.5, color=DANGER, line=1.4)
footer(s, 3)

# ============ P4 方案总览 ============
s = new_slide(1, "口述进，行动出：四步闭环，每一步都能复核",
              "抽出来的每一条病，都能回查到用户原话")
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
s = new_slide(1, "第一屏：一段话，直接变成一张家系图")
rect(s, M, 2.1, 8.1, 4.35, fill=SURFACE, line=LINE)
picture_fit(s, os.path.join(SHOTS, "02-chat.png"), M + 0.12, 2.2, 7.86, 4.15)
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
s = new_slide(1, "第二屏：算清楚，哪一部分本就能拿回来")
rect(s, M, 2.1, 5.85, 3.9, fill=SURFACE, line=LINE)
picture_fit(s, os.path.join(SHOTS, "03-risk.png"), M + 0.1, 2.18, 5.65, 3.76)
tf = text_box(s, M, 6.08, 5.85, 0.35)
para(tf, "可回收风险（FINDRISC）：把「可改」与「改不了」分开算", size=10.5, color=MUTED, first=True)

rect(s, 6.95, 2.1, 5.6, 3.9, fill=SURFACE, line=LINE)
picture_fit(s, os.path.join(SHOTS, "04-cvd.png"), 7.05, 2.18, 5.4, 3.76)
tf = text_box(s, 6.95, 6.08, 5.6, 0.35)
para(tf, "心血管风险（China-PAR）：改任一项实时重算，纯本地计算", size=10.5, color=MUTED, first=True)

tf = text_box(s, M, 6.45, W, 0.35)
para(tf, "界面上的每个数都能复算：China-PAR 对论文 Table 2 的 8 个验证点，偏差均 ≤ 0.35 个百分点。",
     size=10.5, color=FAINT, first=True)
footer(s, 6)

# ============ P7 技术路线 ============
s = new_slide(2, "四层架构：模型只做它不可替代的一件事")
layers = [
    ("输入层", "语音（Web Speech API）· 自然语言文本", 2.15),
    ("抽取层", "Qwen3-1.7B（本地 llama.cpp）· GBNF 约束解码 · 规则兜底", 3.05),
    ("计算层", "家系图结构信号 · FINDRISC / China-PAR / PLCOm2012 · 可回收分解", 3.95),
    ("交互层", "Agent 工具调用追问 · 依据检索（RAG）· 行动方案", 4.85),
]
for name, desc, y in layers:
    rect(s, M, y, 8.3, 0.74, fill=SURFACE, line=LINE)
    rect(s, M, y, 0.06, 0.74, fill=PRIMARY, radius=False)
    tf = text_box(s, M + 0.25, y + 0.05, 1.5, 0.32)
    para(tf, name, size=12.5, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, M + 1.72, y + 0.05, 6.3, 0.6)
    para(tf, desc, size=11, first=True, line=1.3)
    if y < 4.85:
        ar = s.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(M + 4.1), Inches(y + 0.76),
                                Inches(0.14), Inches(0.1))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2; ar.line.fill.background(); ar.shadow.inherit = False

rect(s, 9.45, 2.15, 3.1, 3.44, fill=RECLAIM_SOFT, line=LINE)
tf = text_box(s, 9.68, 2.28, 2.65, 3.2)
para(tf, "全部在本机", size=12.5, bold=True, color=RECLAIM, first=True)
para(tf, "· 推理：llama-server（127.0.0.1）", size=10, line=1.55)
para(tf, "· 存储：本机 MySQL", size=10, line=1.55)
para(tf, "· 代码里没有任何外部 API 调用", size=10, line=1.55)
para(tf, "· 化验单图片只在内存里转 base64", size=10, line=1.55)
para(tf, "· 断网也能完整演示", size=10, color=RECLAIM, line=1.55)
footer(s, 7)

# ============ P8 三引擎 ============
s = new_slide(2, "三套引擎，各管一段，都对齐原始文献")
engines = [
    ("FINDRISC", "糖代谢风险", "年龄 / BMI / 腰围 / 用药 / 家族史", "8 个题项，输出可回收分数"),
    ("China-PAR", "心血管 10 年风险", "血压 / 血脂 / 吸烟 / 糖尿病 / 家族史", "适用 35–74 岁，越界只提示不拒绝"),
    ("PLCOm2012", "肺癌 6 年风险", "吸烟量（包年）/ 戒烟年限 / 家族史", "判定是否够得上筛查条件"),
]
cw = (W - 0.5) / 3
for i, (name, what, inputs, note) in enumerate(engines):
    x = M + i * (cw + 0.25)
    rect(s, x, 2.15, cw, 3.3, fill=SURFACE, line=LINE)
    rect(s, x, 2.15, cw, 0.06, fill=PRIMARY, radius=False)
    tf = text_box(s, x + 0.3, 2.33, cw - 0.6, 0.4)
    para(tf, name, size=16.5, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.3, 2.74, cw - 0.6, 0.32)
    para(tf, what, size=12.5, bold=True, first=True)
    tf = text_box(s, x + 0.3, 3.14, cw - 0.6, 1.0)
    para(tf, "输入：" + inputs, size=10.5, color=MUTED, first=True, line=1.4)
    tf = text_box(s, x + 0.3, 4.4, cw - 0.6, 0.9)
    para(tf, note, size=11, color=RECLAIM, first=True, line=1.4)

tf = text_box(s, M, 5.7, W, 0.8)
para(tf, "为什么不用云端大模型算风险：确定性计算可复算、可审计，换任何模型结论都不变；模型只负责把口语变成结构。",
     size=12, first=True, line=1.4)
footer(s, 8)

# ============ P9 准确性 ============
s = new_slide(3, "口语抽取：留出集 F1 从 0.877 到 1.000",
              "每套留出集都是全新措辞、只跑一次；跑过即降级为开发集，不再对外报数")
data = CategoryChartData()
data.categories = ["v2", "v3", "v5", "v7", "v8", "v9"]
data.add_series("留出集 F1", (0.877, 0.868, 0.912, 0.966, 0.982, 1.000))
gf = s.shapes.add_chart(XL_CHART_TYPE.LINE_MARKERS, Inches(M), Inches(2.1), Inches(7.0), Inches(3.15), data)
chart = gf.chart
chart.has_legend = False
chart.has_title = False
chart.font.size = Pt(10); chart.font.name = EA; chart.font.color.rgb = MUTED
plot = chart.plots[0]
plot.has_data_labels = True
dl = plot.data_labels
dl.number_format = "0.000"; dl.number_format_is_linked = False
dl.font.size = Pt(9); dl.font.color.rgb = PRIMARY
try:
    dl.position = XL_LABEL_POSITION.BELOW
except Exception:
    pass
sr = plot.series[0]
sr.format.line.color.rgb = PRIMARY
sr.format.line.width = Pt(2.25)
sr.marker_size = 6
chart.value_axis.maximum_scale = 1.05
chart.value_axis.minimum_scale = 0.80
chart.value_axis.major_gridlines.format.line.color.rgb = LINE

stats = [("6", " 套", "留出集，全部全新措辞", PRIMARY),
         ("30", " 条", "每套样本，只跑一次", PRIMARY),
         ("±10", " %", "置信区间（30 条）", DANGER),
         ("1.000", "", "四项指标全部满分", RECLAIM)]
for i, (big, unit, label, color) in enumerate(stats):
    stat_card(s, 8.1 + (i % 2) * 2.35, 2.1 + (i // 2) * 1.62, 2.2, 1.45, big, unit, label, color)

rect(s, M, 5.5, 7.0, 1.0, fill=SURFACE, line=LINE)
tf = text_box(s, M + 0.25, 5.6, 6.6, 0.8)
para(tf, "机制：留出集只跑一次 → 每次评测自动落盘（commit + 模型 + 逐条预测）→", size=10.5, first=True, line=1.4)
para(tf, "页面数字从 metrics.ts 取值，测试校验其与词表、最新产物一致。", size=10.5, line=1.4)
footer(s, 9)

# ============ P10 判定选型 ============
s = new_slide(3, "遗传模式判定：为什么最后没用大模型做这件事")
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
s = new_slide(3, "我们真的微调了一次，然后被数据否掉")
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
s = new_slide(4, "隐私与合规：写进代码的承诺")
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
s = new_slide(4, "和谁都不一样：把「判断」和「行动」补上")
tf = text_box(s, M, 2.15, 6.0, 3.6)
para(tf, "体检解读 App", size=12, bold=True, color=FAINT, first=True, line=1.2)
para(tf, "只解读当次指标，不看家族", size=10.5, color=MUTED, line=1.3)
para(tf, "医院问卷", size=12, bold=True, color=FAINT, space_before=10, line=1.2)
para(tf, "家族史压成「有 / 无」", size=10.5, color=MUTED, line=1.3)
para(tf, "临床家系图工具", size=12, bold=True, color=FAINT, space_before=10, line=1.2)
para(tf, "医生画在病历本上，患者见不到第二次", size=10.5, color=MUTED, line=1.3)
para(tf, "通用健康 App", size=12, bold=True, color=FAINT, space_before=10, line=1.2)
para(tf, "给建议，但不复算、不说哪部分能拿回来", size=10.5, color=MUTED, line=1.3)

rect(s, M + 5.9, 2.15, 5.1, 3.5, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 6.15, 2.28, 4.6, 3.2)
para(tf, "我们做的四件事", size=12.5, bold=True, color=PRIMARY, first=True, line=1.45)
para(tf, "① 用口述替代填表，抽出的每条病可回查原话", size=11, line=1.55)
para(tf, "② 把风险拆成「可回收 / 改不了」，并复算给你看", size=11, line=1.55)
para(tf, "③ 所有判断带置信度与拒答路径，不装懂", size=11, line=1.55)
para(tf, "④ 100% 本机推理：断网可演示，数据不出机器", size=11, color=RECLAIM, line=1.55)
para(tf, "", size=6)
para(tf, "评测上也不含糊：留出集只跑一次、产物留痕、微调被 A/B 否掉就不引入。", size=10, color=MUTED, line=1.45)
footer(s, 13)

# ============ P14 价值与落地 ============
s = new_slide(4, "落地：一台普通电脑就能跑完整个闭环",
              "没有 API 账单，也没有额度限制——这是「本机推理」带来的直接好处")
cards = [
    ("0 元", "推理成本", "模型跑在本机，不产生按次计费；演示与试点不需要预算审批"),
    ("1 台", "部署规模", "单机（16 GB 显存）即可承载模型、站点与数据库"),
    ("3 类", "使用场景", "体检中心问诊前自助梳理 · 家庭医生随访 · 个人自查后带图就医"),
]
cw = (W - 0.5) / 3
for i, (big, label, desc) in enumerate(cards):
    x = M + i * (cw + 0.25)
    rect(s, x, 2.2, cw, 2.35, fill=SURFACE, line=LINE)
    tf = text_box(s, x + 0.3, 2.4, cw - 0.6, 0.6)
    para(tf, big, size=30, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.3, 3.02, cw - 0.6, 0.3)
    para(tf, label, size=11.5, bold=True, first=True)
    tf = text_box(s, x + 0.3, 3.38, cw - 0.6, 1.0)
    para(tf, desc, size=10.5, color=MUTED, first=True, line=1.4)

rect(s, M, 4.85, W, 1.55, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 4.98, W - 0.6, 1.3)
para(tf, "下一步：把口语留出集扩到 100 条（当前 30 条，置信区间约 ±10%）· 引入医生复核试点 · 补姻亲与曾祖辈的关系支持",
     size=11.5, first=True, line=1.45)
para(tf, "更长远：把「可回收」从建议升级为可追踪的行动记录，让用户看到半年后复算的数字变化。",
     size=11.5, color=MUTED, line=1.45)
footer(s, 14)

# ============ P15 团队 ============
s = new_slide(5, "团队：谁在负责哪一块", "【待填】请补充成员姓名、学校 / 单位、分工与代表成果")
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

# ============ P16 结尾 ============
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, 13.333, 7.5, fill=BG, radius=False)
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
tf = text_box(s, M, 2.25, 10, 0.55)
para(tf, "家系", size=13, bold=True, color=PRIMARY, first=True)
tf = text_box(s, M, 2.8, 11, 1.1)
para(tf, "把家族史从一句话，变成能算、能改、能复算的东西", size=30, bold=True, first=True)
tf = text_box(s, M, 4.05, 10, 0.5)
para(tf, "谢谢聆听 · 欢迎提问", size=14, color=MUTED, first=True)
rect(s, M, 4.75, 1.5, 0.05, fill=PRIMARY, radius=False)
tf = text_box(s, M, 5.05, 11, 1.2)
para(tf, "现场可演示：口述家族史 → 家系图 → 三套风险 → 可回收建议（全程本机，断网可用）",
     size=11.5, color=MUTED, first=True, line=1.6)
para(tf, "代码与评测产物：留出集 6 套、每套 30 条，docs/eval-results 可逐条复核", size=11.5, color=MUTED, line=1.6)


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
    "四层架构：模型只做把口语变成结构这一件事。",
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
    if i < len(NOTES):
        slide.notes_slide.notes_text_frame.text = NOTES[i]

flatten(prs)
out = os.path.join(CWD, "deliverables", "家系-答辩-v2.pptx")
os.makedirs(os.path.dirname(out), exist_ok=True)
prs.save(out)
print("已生成:", out, "| 页数:", len(prs.slides._sldIdLst))
