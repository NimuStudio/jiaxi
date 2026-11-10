# -*- coding: utf-8 -*-
"""生成「家系」比赛答辩 PPT（16:9，中文）。

设计遵循产品自身的视觉语言：浅蓝底 + 主蓝描边卡片 + 深蓝文字。
所有数字来自仓库内的评测产物与 metrics.ts，不做四舍五入的美化。
"""
import os
from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.util import Inches, Pt, Emu

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
# 路径相对脚本自身，避免只能在某个工作目录下运行（踩过一次）
# 脚本位于 pedigree/scripts/，项目根是它的上一级
CWD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(CWD, "docs", "screenshots")

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]

M = 0.78          # 左边距
W = 13.333 - 2 * M


def set_font(run, size=14, bold=False, color=TEXT, italic=False):
    f = run.font
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    f.name = EA
    # 中文字体要写 ea，否则只有拉丁字符用雅黑
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:ea", "a:cs"):
        el = rPr.find('{http://schemas.openxmlformats.org/drawingml/2006/main}' + tag.split(':')[1])
        if el is None:
            from lxml import etree
            el = etree.SubElement(rPr, '{http://schemas.openxmlformats.org/drawingml/2006/main}' + tag.split(':')[1])
        el.set("typeface", EA)


def text_box(slide, x, y, w, h, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.paragraphs[0].alignment = align
    return tf


def para(tf, text, size=14, bold=False, color=TEXT, space_before=0, space_after=0, first=False, align=None, line=None):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    if align is not None:
        p.alignment = align
    p.space_before = Pt(space_before)
    p.space_after = Pt(space_after)
    if line:
        p.line_spacing = line
    r = p.add_run()
    r.text = text
    set_font(r, size, bold, color)
    return p


def rect(slide, x, y, w, h, fill=None, line=None, radius=True, shadow=False):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    s = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    if radius:
        s.adjustments[0] = 0.06
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(1)
    s.shadow.inherit = False
    return s


def flatten_shadows(presentation):
    """去掉主题自带的投影：扁平卡片在不同渲染器（PowerPoint / LibreOffice）里更一致。"""
    from lxml import etree
    A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
    P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
    for slide in presentation.slides:
        for shp in slide.shapes:
            el = getattr(shp, "_element", None)
            if el is None:
                continue
            # 关键：形状自带 <p:style> 里的 effectRef 会引用主题投影，
            # 只往 spPr 塞空 effectLst 压不住它（LibreOffice/PowerPoint 都会照主题画）。
            for style in el.findall(P + "style"):
                el.remove(style)
            spPr = el.find(".//" + A + "spPr")
            if spPr is None:
                continue
            for old in spPr.findall(A + "effectLst"):
                spPr.remove(old)
            etree.SubElement(spPr, A + "effectLst")


def style_table(tbl, head_size=11, body_size=11.5, row_h=0.52):
    """表格竖直居中 + 内边距：默认顶端对齐会让行看着发飘。"""
    from pptx.util import Inches as In
    for r in tbl.rows:
        r.height = In(row_h)
    for i, row in enumerate(tbl.rows):
        for cell in row.cells:
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.margin_left = In(0.14)
            cell.margin_right = In(0.10)
            cell.margin_top = In(0.04)
            cell.margin_bottom = In(0.04)


def new_slide(kicker, title, sub=None):
    s = prs.slides.add_slide(BLANK)
    rect(s, 0, 0, 13.333, 7.5, fill=BG, radius=False)
    # 左侧竖向主色条
    rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)
    tf = text_box(s, M, 0.52, W, 0.3)
    para(tf, kicker.upper(), size=11, bold=True, color=PRIMARY, first=True)
    tf2 = text_box(s, M, 0.86, W, 0.6)
    para(tf2, title, size=28, bold=True, first=True)
    if sub:
        tf3 = text_box(s, M, 1.46, W, 0.4)
        para(tf3, sub, size=13, color=MUTED, first=True)
    return s


def footer(slide, idx):
    tf = text_box(slide, M, 6.95, 8, 0.3)
    para(tf, "家系 · 家族健康风险量化", size=9, color=FAINT, first=True)
    tf2 = text_box(slide, 13.333 - M - 1.2, 6.95, 1.2, 0.3, align=PP_ALIGN.RIGHT)
    para(tf2, f"{idx:02d}", size=9, color=FAINT, first=True)


def chip(slide, x, y, w, text, fill=SURFACE, line=LINE, color=MUTED, size=11, h=0.34):
    rect(slide, x, y, w, h, fill=fill, line=line)
    tf = text_box(slide, x, y + 0.03, w, h - 0.06, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    para(tf, text, size=size, color=color, first=True, align=PP_ALIGN.CENTER)


def picture_fit(slide, path, x, y, max_w, max_h):
    from PIL import Image
    iw, ih = Image.open(path).size
    scale = min(max_w / iw, max_h / ih)
    w, h = iw * scale, ih * scale
    slide.shapes.add_picture(path, Inches(x + (max_w - w) / 2), Inches(y + (max_h - h) / 2), Inches(w), Inches(h))
    return w, h


# ---------------- S1 封面 ----------------
s = prs.slides.add_slide(BLANK)
rect(s, 0, 0, 13.333, 7.5, fill=BG, radius=False)
circ = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(8.4), Inches(-1.6), Inches(6.6), Inches(6.6))
circ.fill.solid(); circ.fill.fore_color.rgb = PRIMARY_SOFT; circ.line.fill.background(); circ.shadow.inherit = False
rect(s, 0, 0, 0.14, 7.5, fill=PRIMARY, radius=False)

tf = text_box(s, M, 1.5, 8.6, 0.4)
para(tf, "AI + Web / AI 与健康", size=13, bold=True, color=PRIMARY, first=True)

tf = text_box(s, M, 2.0, 8.8, 1.2)
para(tf, "家 系", size=64, bold=True, first=True)

tf = text_box(s, M, 3.25, 8.9, 1.5)
para(tf, "把家族口述的病史，整理成一张家系图", size=22, color=TEXT, first=True, space_after=6)
para(tf, "并算出你的风险里，有多少是「能拿回来的」", size=22, color=TEXT)

rect(s, M, 5.25, 1.5, 0.05, fill=PRIMARY, radius=False)

labels = [("三套风险引擎", "FINDRISC · China-PAR · PLCOm2012"),
          ("100% 本机推理", "家族信息不出这台机器"),
          ("口语留出集 F1", "1.000（30 条全新措辞）")]
for i, (h1, h2) in enumerate(labels):
    x = M + i * 4.0
    tf = text_box(s, x, 5.6, 3.7, 0.35)
    para(tf, h1, size=14, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x, 5.95, 3.7, 0.35)
    para(tf, h2, size=11, color=MUTED, first=True)

# ---------------- S2 问题 ----------------
s = new_slide("问题", "信息在，判断不在，行动更不在")
items = [
    ("01", "体检报告只解读当次指标", "「未见异常」四个字，不看你父亲 52 岁放的支架。"),
    ("02", "医院问卷把家族史压成「有 / 无」", "最关键的三件事——谁、几岁发病、几个亲属——全部丢掉。"),
    ("03", "建议从不说「我这么改到底图什么」", "健康 App 给建议，却从不复算，也不告诉你哪部分本就能拿回来。"),
]
y = 2.05
for num, h1, h2 in items:
    tf = text_box(s, M, y, 0.7, 0.4)
    para(tf, num, size=13, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, M + 0.75, y - 0.04, 6.9, 0.4)
    para(tf, h1, size=16, bold=True, first=True)
    tf = text_box(s, M + 0.75, y + 0.38, 6.9, 0.5)
    para(tf, h2, size=12, color=MUTED, first=True)
    y += 1.35

rect(s, 8.35, 1.95, 4.2, 3.6, fill=SURFACE, line=LINE)
tf = text_box(s, 8.6, 2.15, 3.7, 0.35)
para(tf, "真实的一句话", size=11, bold=True, color=FAINT, first=True)
tf = text_box(s, 8.6, 2.55, 3.7, 2.2)
para(tf, "「我爸 52 岁放了支架，爷爷糖尿病，", size=13, color=TEXT, first=True, line=1.5)
para(tf, "外公是脑溢血走的。」", size=13, color=TEXT, line=1.5)
para(tf, "", size=8)
para(tf, "这三条信息，没有一个体检 App 会问。", size=12, color=DANGER, line=1.4)
para(tf, "", size=8)
para(tf, "而它们恰好是你 10 年心血管风险里的家族史项——", size=11, color=MUTED, line=1.4)
para(tf, "FINDRISC 记 5 分，China-PAR 单独一个系数。", size=11, color=MUTED, line=1.4)
rect(s, 8.6, 4.62, 3.5, 0.02, fill=LINE, radius=False)
tf = text_box(s, 8.6, 4.75, 3.7, 0.7)
para(tf, "家系图在临床用了六十年，", size=10, color=FAINT, first=True, line=1.35)
para(tf, "患者一辈子见不到第二次。", size=10, color=FAINT, line=1.35)
footer(s, 2)

# ---------------- S3 方案 ----------------
s = new_slide("方案", "口述进，行动出：四步闭环", "每一步都能被用户复核——抽出来的每一条病，都能回查原话")
steps = [
    ("①", "口述", "语音或一句话描述家族病史，不用填表", "输出：结构化条目"),
    ("②", "家系图", "自动结构化：谁、几岁发病、几个亲属", "输出：可点选回溯的家系图"),
    ("③", "风险", "三套引擎分别算糖代谢、心血管、肺癌", "输出：三个百分比 + 分层"),
    ("④", "可回收", "把可改的部分挑出来，给出这周就能做的一步", "输出：一份行动清单"),
]
cw = (W - 0.45) / 4
for i, (mark, h1, h2, h3) in enumerate(steps):
    x = M + i * (cw + 0.15)
    rect(s, x, 2.1, cw, 2.5, fill=SURFACE, line=LINE)
    tf = text_box(s, x + 0.25, 2.25, cw - 0.5, 0.45)
    para(tf, mark, size=20, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.25, 2.75, cw - 0.5, 0.4)
    para(tf, h1, size=17, bold=True, first=True)
    tf = text_box(s, x + 0.25, 3.2, cw - 0.5, 1.1)
    para(tf, h2, size=11.5, color=MUTED, first=True, line=1.4)
    tf = text_box(s, x + 0.25, 4.05, cw - 0.5, 0.35)
    para(tf, h3, size=10.5, color=PRIMARY, first=True)
    if i < 3:
        ar = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + cw + 0.005), Inches(3.15), Inches(0.14), Inches(0.22))
        ar.fill.solid(); ar.fill.fore_color.rgb = LINE2; ar.line.fill.background(); ar.shadow.inherit = False

rect(s, M, 5.0, W, 1.15, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 5.15, W - 0.6, 0.9)
para(tf, "不编数字：每个进入产品的系数都登记出处与核实状态；查不到出处的数字不上界面。",
     size=13, color=TEXT, first=True, line=1.4)
para(tf, "不替代医生：所有判断都写成「提示」，并给出模型置信度与拒答路径。", size=13, color=TEXT, line=1.4)
footer(s, 3)

# ---------------- S4 截图：家系梳理 ----------------
s = new_slide("产品", "第一屏：把一段话，变成一张家系图")
rect(s, M, 1.95, 8.1, 4.6, fill=SURFACE, line=LINE)
picture_fit(s, f"{SHOTS}/02-chat.png", M + 0.12, 2.05, 7.86, 4.4)
for i, (h1, h2) in enumerate([
    ("语音或文字输入", "不支持语音的浏览器自动隐藏入口，不留坏入口"),
    ("逐条回查原文", "抽出的每条病都能在用户原话里找到依据"),
    ("Agent 主动追问", "缺字段就反问，不让用户自己填表"),
]):
    y = 2.15 + i * 1.45
    tf = text_box(s, 9.2, y, 3.3, 0.35)
    para(tf, h1, size=14, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, 9.2, y + 0.36, 3.3, 0.7)
    para(tf, h2, size=11, color=MUTED, first=True, line=1.35)
footer(s, 4)

# ---------------- S5 截图：风险与可回收 ----------------
s = new_slide("产品", "第二屏：算清楚，哪一部分本就能拿回来")
rect(s, M, 1.95, 5.85, 4.0, fill=SURFACE, line=LINE)
picture_fit(s, f"{SHOTS}/03-risk.png", M + 0.1, 2.02, 5.65, 3.86)
tf = text_box(s, M, 6.05, 5.85, 0.4)
para(tf, "可回收风险（FINDRISC）：把「可改」与「改不了」分开算", size=11, color=MUTED, first=True)

rect(s, 6.95, 1.95, 5.6, 4.0, fill=SURFACE, line=LINE)
picture_fit(s, f"{SHOTS}/04-cvd.png", 7.05, 2.02, 5.4, 3.86)
tf = text_box(s, 6.95, 6.05, 5.6, 0.4)
para(tf, "心血管风险（China-PAR）：改任一项实时重算，纯本地计算", size=11, color=MUTED, first=True)

tf = text_box(s, M, 6.45, W, 0.4)
para(tf, "界面上的每一个数都能复算：China-PAR 对论文 Table 2 的 8 个验证点，偏差均 ≤ 0.35 个百分点。",
     size=11, color=FAINT, first=True)
footer(s, 5)

# ---------------- S6 三引擎 ----------------
s = new_slide("方法", "三套引擎，各管一段，都对齐原始文献")
engines = [
    ("FINDRISC", "糖代谢风险", "年龄 / BMI / 腰围 / 用药 / 家族史", "8 个题项，输出可回收分数"),
    ("China-PAR", "心血管 10 年风险", "血压 / 血脂 / 吸烟 / 糖尿病 / 家族史", "适用 35–74 岁，越界只提示不拒绝"),
    ("PLCOm2012", "肺癌 6 年风险", "吸烟量（包年）/ 戒烟年限 / 家族史", "判定是否够得上筛查条件"),
]
cw = (W - 0.5) / 3
for i, (name, what, inputs, note) in enumerate(engines):
    x = M + i * (cw + 0.25)
    rect(s, x, 2.0, cw, 3.5, fill=SURFACE, line=LINE)
    rect(s, x, 2.0, cw, 0.06, fill=PRIMARY, radius=False)
    tf = text_box(s, x + 0.3, 2.2, cw - 0.6, 0.4)
    para(tf, name, size=17, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, x + 0.3, 2.62, cw - 0.6, 0.35)
    para(tf, what, size=13, bold=True, first=True)
    tf = text_box(s, x + 0.3, 3.05, cw - 0.6, 1.0)
    para(tf, "输入：" + inputs, size=11, color=MUTED, first=True, line=1.4)
    tf = text_box(s, x + 0.3, 4.35, cw - 0.6, 0.9)
    para(tf, note, size=11.5, color=RECLAIM, first=True, line=1.4)

tf = text_box(s, M, 5.75, W, 0.9)
para(tf, "为什么不用云端大模型算风险：确定性计算可复算、可审计，换任何模型结论都不变；模型只负责把口语变成结构。",
     size=12.5, color=TEXT, first=True, line=1.4)
footer(s, 6)

# ---------------- S7 架构 ----------------
s = new_slide("技术", "四层架构：模型只做它不可替代的一件事")
layers = [
    ("输入层", "语音（Web Speech API）· 自然语言文本", 2.0),
    ("抽取层", "Qwen3-1.7B（本地 llama.cpp）· GBNF 约束解码 · 规则兜底", 2.95),
    ("计算层", "家系图结构信号 · FINDRISC / China-PAR / PLCOm2012 · 可回收分解", 3.9),
    ("交互层", "Agent 工具调用追问 · 依据检索（RAG）· 行动方案", 4.85),
]
for name, desc, y in layers:
    rect(s, M, y, 8.4, 0.78, fill=SURFACE, line=LINE)
    rect(s, M, y, 0.06, 0.78, fill=PRIMARY, radius=False)
    tf = text_box(s, M + 0.25, y + 0.06, 1.5, 0.35)
    para(tf, name, size=13, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, M + 1.75, y + 0.06, 6.4, 0.6)
    para(tf, desc, size=11.5, color=TEXT, first=True, line=1.3)

rect(s, 9.55, 2.0, 3.0, 3.6, fill=RECLAIM_SOFT, line=LINE)
tf = text_box(s, 9.75, 2.15, 2.6, 0.4)
para(tf, "全部在本机", size=13, bold=True, color=RECLAIM, first=True)
tf = text_box(s, 9.75, 2.6, 2.6, 2.9)
para(tf, "· 推理：llama-server（127.0.0.1）", size=10.5, color=TEXT, first=True, line=1.5)
para(tf, "· 存储：本机 MySQL", size=10.5, color=TEXT, line=1.5)
para(tf, "· 代码里没有任何外部 API 调用", size=10.5, color=TEXT, line=1.5)
para(tf, "· 化验单图片只在内存里转 base64", size=10.5, color=TEXT, line=1.5)
para(tf, "· 零外部依赖：不需要 API Key，也不受额度限流", size=10.5, color=TEXT, line=1.5)
para(tf, "· 竞赛现场断网也能完整演示", size=10.5, color=RECLAIM, line=1.5)
footer(s, 7)

# ---------------- S8 抽取准确性 ----------------
s = new_slide("准确性", "口语抽取：留出集 F1 从 0.877 到 1.000", "每套留出集都是全新措辞、只跑一次；跑过即降级为开发集，不再对外报数")
chart_data = CategoryChartData()
chart_data.categories = ["v2", "v3", "v5", "v7", "v8", "v9"]
chart_data.add_series("留出集 F1", (0.877, 0.868, 0.912, 0.966, 0.982, 1.000))
gf = s.shapes.add_chart(XL_CHART_TYPE.LINE_MARKERS, Inches(M), Inches(1.95), Inches(7.3), Inches(3.6), chart_data)
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
    from pptx.enum.chart import XL_LABEL_POSITION
    dl.position = XL_LABEL_POSITION.BELOW
except Exception:
    pass
series = plot.series[0]
series.format.line.color.rgb = PRIMARY
series.format.line.width = Pt(2.25)
series.marker_size = 7
chart.value_axis.maximum_scale = 1.05
chart.value_axis.minimum_scale = 0.80
chart.value_axis.has_major_gridlines = True
chart.value_axis.major_gridlines.format.line.color.rgb = LINE

rights = [
    ("留出集制度", "每套 30 条全新措辞，只跑一次；开发集涨、留出集跌视为过拟合并回退"),
    ("产物可追溯", "每次评测自动落盘：commit + 模型 + 逐条预测"),
    ("页面数字单一来源", "登录页数字从 metrics.ts 取值，测试校验与词表、最新产物一致"),
]
for i, (h1, h2) in enumerate(rights):
    y = 1.95 + i * 1.25
    tf = text_box(s, 8.35, y, 4.2, 0.35)
    para(tf, h1, size=13, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, 8.35, y + 0.33, 4.2, 0.85)
    para(tf, h2, size=10.5, color=MUTED, first=True, line=1.35)

rect(s, M, 5.75, W, 0.95, fill=SURFACE, line=LINE)
tf = text_box(s, M + 0.25, 5.88, W - 0.5, 0.75)
para(tf, "当前指标：Precision 1.000 · Recall 1.000 · F1 1.000 · 年龄准确率 1.000（30 条全新措辞，只跑一次）",
     size=12.5, color=TEXT, first=True)
para(tf, "边界：30 条样本的置信区间约 ±10%，真实口述分布更宽；我们不把 1.000 说成「准确率 100%」。",
     size=10.5, color=FAINT, line=1.3)
footer(s, 8)

# ---------------- S9 判定：typed decision ----------------
s = new_slide("技术选型", "遗传模式判定：为什么最后没用大模型做这件事")
rows = [
    ("OpenJev-Q4（18.5 GB，通用决策模型）", "40%", "6.3 s", "隐性 / X 连锁 / 线粒体 三类全错"),
    ("结构逻辑回归（12 维特征，2.3 KB）", "96%", "< 0.1 s", "同一批均衡样本，每类 5 条"),
]
tbl_shape = s.shapes.add_table(len(rows) + 1, 4, Inches(M), Inches(2.0), Inches(W), Inches(1.9))
tbl = tbl_shape.table
tbl.columns[0].width = Inches(4.9)
tbl.columns[1].width = Inches(1.4)
tbl.columns[2].width = Inches(1.5)
tbl.columns[3].width = Inches(3.9)
heads = ["方案", "准确率", "单次延迟", "说明"]
for j, h in enumerate(heads):
    cell = tbl.cell(0, j)
    cell.text = ""
    p = cell.text_frame.paragraphs[0]
    r = p.add_run(); r.text = h
    set_font(r, 11.5, True, MUTED)
    cell.fill.solid(); cell.fill.fore_color.rgb = PRIMARY_SOFT
for i, row in enumerate(rows, start=1):
    for j, val in enumerate(row):
        cell = tbl.cell(i, j)
        cell.text = ""
        p = cell.text_frame.paragraphs[0]
        r = p.add_run(); r.text = val
        set_font(r, 12 if j == 0 else 12, j == 1, TEXT if j != 3 else MUTED)
        cell.fill.solid(); cell.fill.fore_color.rgb = SURFACE
style_table(tbl, row_h=0.5)

tf = text_box(s, M, 4.15, W, 1.6)
para(tf, "结论：这个任务的输出空间被 GBNF + 词表 + few-shot 收得很窄，问题不在模型容量，而在「家系结构本身就能判」。",
     size=13, bold=True, color=TEXT, first=True, line=1.45)
para(tf, "所以默认后端换成结构模型（毫秒级、无需 18 GB 权重）；OpenJev 保留为可切换的对照后端，用 INHERITANCE_BACKEND=model 打开。",
     size=11.5, color=MUTED, line=1.45)
para(tf, "协议层照 TypeSafe /v1/systemone 实现（choice / score / noul），换官方 JEV API 只改一个环境变量。",
     size=11.5, color=MUTED, line=1.45)

rect(s, M, 5.5, W, 1.1, fill=SURFACE, line=LINE)
tf = text_box(s, M + 0.28, 5.62, W - 0.56, 0.85)
para(tf, "产品里的样子：模型给出五种模式的概率 → 最高项达门槛才显示结论；不达门槛就退回「证据不足」，",
     size=11.5, color=TEXT, first=True, line=1.35)
para(tf, "并把缺什么列出来让用户补一句（例如「父系亲属是否患病」），而不是硬给一个模式。",
     size=11.5, color=TEXT, line=1.35)
footer(s, 9)

# ---------------- S10 微调 A/B ----------------
s = new_slide("方法论", "我们真的微调了一次，然后被数据否掉")
rows = [
    ("基线 + few-shot + 规则层", "1.000", "0.893", "0.943", "27/30"),
    ("微调 + 规则层", "1.000", "0.893", "0.943", "27/30"),
    ("基线模型原始能力（跳过规则层）", "0.957", "0.786", "0.863", "23/30"),
    ("微调模型原始能力（跳过规则层）", "0.957", "0.786", "0.863", "23/30"),
]
tbl_shape = s.shapes.add_table(len(rows) + 1, 5, Inches(M), Inches(2.0), Inches(W), Inches(2.2))
tbl = tbl_shape.table
widths = [5.5, 1.6, 1.6, 1.6, 1.5]
for j, w in enumerate(widths):
    tbl.columns[j].width = Inches(w)
heads = ["配置（封存留出集 30 条，从未参与训练）", "Precision", "Recall", "F1", "完全匹配"]
for j, h in enumerate(heads):
    cell = tbl.cell(0, j); cell.text = ""
    r = cell.text_frame.paragraphs[0].add_run(); r.text = h
    set_font(r, 11, True, MUTED)
    cell.fill.solid(); cell.fill.fore_color.rgb = PRIMARY_SOFT
for i, row in enumerate(rows, start=1):
    for j, val in enumerate(row):
        cell = tbl.cell(i, j); cell.text = ""
        r = cell.text_frame.paragraphs[0].add_run(); r.text = val
        set_font(r, 11.5, j == 3, TEXT if j else TEXT)
        cell.fill.solid(); cell.fill.fore_color.rgb = SURFACE
style_table(tbl, row_h=0.46)

rect(s, M, 4.55, W, 1.75, fill=RECLAIM_SOFT, line=LINE)
tf = text_box(s, M + 0.3, 4.7, W - 0.6, 1.5)
para(tf, "逐条比对 30 条输出：模型层只有 2 条不同，指标完全一致；叠加规则层后 30/30 完全相同。",
     size=12.5, color=TEXT, first=True, line=1.4)
para(tf, "处置：不引入微调模型，省下 1.1 GB 权重与一套维护。训练链路保留（1355 条数据 / 3 epoch / 21 分钟 / merge → GGUF → Q4）。",
     size=11.5, color=MUTED, line=1.4)
para(tf, "负结果也是结果：它证明提升空间在词表与规则，而不在参数量。", size=11.5, color=RECLAIM, line=1.4)
footer(s, 10)

# ---------------- S11 隐私与合规 ----------------
s = new_slide("边界", "隐私与合规：写进代码的承诺")
left = [
    ("100% 本机推理", "llama-server 跑在 127.0.0.1；代码里没有任何外部 API 调用"),
    ("数据不出机器", "家系与体检数字存在本机 MySQL；化验单图片只在内存里转 base64，不落盘不入库"),
    ("不宣称诊断", "遗传模式等判断统一写「提示，不是诊断」，并显示置信度"),
    ("不确定就不显示", "置信度不足时退回「证据不足」并给出缺口追问，而不是硬给结论"),
]
for i, (h1, h2) in enumerate(left):
    y = 2.0 + i * 1.15
    tf = text_box(s, M, y, 6.6, 0.35)
    para(tf, h1, size=14, bold=True, color=PRIMARY, first=True)
    tf = text_box(s, M, y + 0.34, 6.6, 0.7)
    para(tf, h2, size=11, color=MUTED, first=True, line=1.35)

rect(s, 7.75, 1.95, 4.8, 4.4, fill=SURFACE, line=LINE)
tf = text_box(s, 8.0, 2.1, 4.3, 0.4)
para(tf, "我们不做的事", size=13, bold=True, color=DANGER, first=True)
tf = text_box(s, 8.0, 2.55, 4.3, 3.6)
for line in ["不埋点统计用户病史", "不上传任何图片或文本",
             "不给出用药建议", "不把风险说成「预测你会得病」",
             "不在界面上出现查不到出处的数字"]:
    para(tf, "· " + line, size=11.5, color=TEXT, first=(line.startswith("不埋点")), line=1.6)
footer(s, 11)

# ---------------- S12 差异化 + 路线 ----------------
s = new_slide("价值", "和谁都不一样：把「判断」和「行动」补上")
tf = text_box(s, M, 1.95, 6.3, 3.6)
para(tf, "体检解读 App", size=12.5, bold=True, color=FAINT, first=True, line=1.2)
para(tf, "只解读当次指标，不看家族", size=11, color=MUTED, line=1.3)
para(tf, "医院问卷", size=12.5, bold=True, color=FAINT, space_before=8, line=1.2)
para(tf, "家族史压成「有 / 无」", size=11, color=MUTED, line=1.3)
para(tf, "临床家系图工具", size=12.5, bold=True, color=FAINT, space_before=8, line=1.2)
para(tf, "医生画在病历本上，患者见不到第二次", size=11, color=MUTED, line=1.3)
para(tf, "通用健康 App", size=12.5, bold=True, color=FAINT, space_before=8, line=1.2)
para(tf, "给建议，但不复算、不说哪部分能拿回来", size=11, color=MUTED, line=1.3)
rect(s, M + 6.1, 2.0, 5.2, 3.5, fill=PRIMARY_SOFT, line=LINE)
tf = text_box(s, M + 6.35, 2.15, 4.7, 3.2)
para(tf, "我们做的四件事", size=13, bold=True, color=PRIMARY, first=True, line=1.4)
para(tf, "① 用口述替代填表，抽出的每条病可回查原话", size=11.5, color=TEXT, line=1.5)
para(tf, "② 把风险拆成「可回收 / 改不了」，并复算给你看", size=11.5, color=TEXT, line=1.5)
para(tf, "③ 所有判断带置信度与拒答路径，不装懂", size=11.5, color=TEXT, line=1.5)
para(tf, "④ 100% 本机推理：断网可演示，数据不出机器", size=11.5, color=RECLAIM, line=1.5)
para(tf, "", size=6)
para(tf, "评测上也不含糊：留出集只跑一次、产物留痕、", size=10.5, color=MUTED, line=1.4)
para(tf, "微调被 A/B 否掉就不引入。", size=10.5, color=MUTED, line=1.4)

rect(s, M, 5.7, W, 0.95, fill=SURFACE, line=LINE)
tf = text_box(s, M + 0.25, 5.82, W - 0.5, 0.7)
para(tf, "下一步：把口语留出集扩到 100 条（当前 30 条，置信区间约 ±10%）· 引入医生复核试点 · 补姻亲与曾祖辈的关系支持",
     size=11.5, color=TEXT, first=True, line=1.35)
footer(s, 12)

NOTES = [
    "开场：家系是一个把「家族口述病史」变成可计算风险的工具。一句话——你的风险里，有多少是能拿回来的。",
    "痛点三层：信息在、判断不在、行动不在。右边那句真话，任何体检 App 都不会问，这正是切入点。",
    "四步闭环，重点是每一步用户都能复核：抽出来的每条病都能回查原话。下面两条红线是不编数字、不替代医生。",
    "第一屏演示：一段话进来，直接变成家系图。强调语音入口在浏览器不支持时自动隐藏，不留坏入口。",
    "第二屏：可回收风险把「可改」和「改不了」分账；China-PAR 改任一项实时重算，全部本地。",
    "三套引擎各管一段，都对齐原始文献。为什么不交给大模型算：确定性计算才可复算、可审计。",
    "四层架构。核心是一句话：模型只做它不可替代的事——把口语变成结构。右边强调全部在本机、断网可演示。",
    "准确性是重点：六套留出集，每套全新措辞只跑一次，F1 从 0.877 到 1.000。同时说清边界：30 条样本置信区间约 ±10%。",
    "技术选型：同一批样本上，18.5GB 的通用决策模型只有 40%，12 维结构模型 96%。结论是问题不在模型容量。",
    "方法论：我们真的微调过，封存集上 A/B 完全一致，所以不引入。负结果也是结果，它把优化方向指回了词表与规则。",
    "边界与合规：100% 本机、数据不出机器、不宣称诊断、不确定就不显示。右边是明确的「不做清单」。",
    "收尾：和三类现有方案的区别，以及下一步（扩到 100 条留出集、医生复核试点）。留时间给提问。",
]
for i, slide in enumerate(prs.slides):
    if i < len(NOTES):
        slide.notes_slide.notes_text_frame.text = NOTES[i]

flatten_shadows(prs)

out_dir = os.path.join(CWD, "deliverables")
os.makedirs(out_dir, exist_ok=True)
out = os.path.join(out_dir, "家系-答辩-v1.pptx")
prs.save(out)
print("已生成:", out, "| 幻灯片数:", len(prs.slides.__iter__.__self__._sldIdLst))
