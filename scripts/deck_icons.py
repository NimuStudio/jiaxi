# -*- coding: utf-8 -*-
"""家系答辩 PPT 的图标集：全部程序绘制（超采样后缩放，边缘干净）。

统一规格：256x256、透明底、线宽 14、主色 #1A6FB5。
用法：new_slide(..., icon="tree") 会把图标放在标题左侧。
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "deck-assets", "icons")
os.makedirs(OUT, exist_ok=True)

S = 1024          # 超采样尺寸
FINAL = 256
INK = (26, 111, 181, 255)
LW = 56


def canvas():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def line(d, p1, p2, w=LW):
    d.line([p1, p2], fill=INK, width=w, joint="curve")


def save(img, name):
    img.resize((FINAL, FINAL), Image.LANCZOS).save(os.path.join(OUT, name))
    print("  ", name)


def rounded(d, box, r, w=LW):
    d.rounded_rectangle(box, radius=r, outline=INK, width=w)


# 1) 语音/话筒
img, d = canvas()
rounded(d, (360, 230, 664, 620), 152)
d.arc((300, 380, 724, 760), start=0, end=180, fill=INK, width=LW)
line(d, (512, 700), (512, 860))
line(d, (380, 860), (644, 860))
save(img, "mic.png")

# 2) 对话/问答
img, d = canvas()
rounded(d, (180, 250, 844, 700), 90)
d.polygon([(330, 690), (330, 830), (500, 690)], fill=INK)
for cx in (380, 512, 644):
    d.ellipse((cx - 34, 445 - 34, cx + 34, 445 + 34), fill=INK)
save(img, "chat.png")

# 3) 家系树
img, d = canvas()
rounded(d, (400, 150, 624, 330), 40)
rounded(d, (170, 690, 394, 870), 40)
rounded(d, (620, 690, 844, 870), 40)
line(d, (512, 330), (512, 510))
line(d, (282, 510), (732, 510))
line(d, (282, 510), (282, 690))
line(d, (732, 510), (732, 690))
save(img, "tree.png")

# 4) 仪表盘/风险
img, d = canvas()
d.arc((180, 230, 844, 894), start=180, end=360, fill=INK, width=LW)
line(d, (512, 620), (700, 400))
d.ellipse((462, 570, 562, 670), fill=INK)
line(d, (250, 620), (250, 700))
line(d, (774, 620), (774, 700))
line(d, (512, 830), (512, 890))
save(img, "gauge.png")

# 5) 播放/演示
img, d = canvas()
d.ellipse((170, 170, 854, 854), outline=INK, width=LW)
d.polygon([(430, 350), (430, 674), (720, 512)], fill=INK)
save(img, "play.png")

# 6) 芯片/模型
img, d = canvas()
rounded(d, (280, 280, 744, 744), 60)
rounded(d, (440, 440, 584, 584), 30)
for t in (360, 512, 664):
    line(d, (t, 170), (t, 280))
    line(d, (t, 744), (t, 854))
    line(d, (170, t), (280, t))
    line(d, (744, t), (854, t))
save(img, "chip.png")

# 7) 计算器/公式
img, d = canvas()
rounded(d, (240, 150, 784, 874), 70)
d.rectangle((340, 240, 684, 360), fill=INK)
for y in (480, 620, 760):
    for x in (360, 512, 664):
        d.ellipse((x - 40, y - 40, x + 40, y + 40), fill=INK)
save(img, "calc.png")

# 8) 靶心/准确性
img, d = canvas()
for r in (300, 210, 120):
    d.ellipse((512 - r, 512 - r, 512 + r, 512 + r), outline=INK, width=LW)
d.ellipse((462, 462, 562, 562), fill=INK)
save(img, "target.png")

# 9) 天平/选型
img, d = canvas()
line(d, (512, 190), (512, 800))
line(d, (250, 800), (774, 800))
line(d, (240, 330), (784, 330))
d.arc((110, 330, 370, 560), start=0, end=180, fill=INK, width=LW)
d.arc((654, 330, 914, 560), start=0, end=180, fill=INK, width=LW)
line(d, (240, 330), (240, 420))
line(d, (784, 330), (784, 420))
save(img, "balance.png")

# 10) 锁/隐私
img, d = canvas()
rounded(d, (250, 470, 774, 870), 70)
d.arc((330, 170, 694, 560), start=180, end=360, fill=INK, width=LW)
line(d, (330, 470), (330, 560))
line(d, (694, 470), (694, 560))
d.ellipse((472, 620, 552, 700), fill=INK)
line(d, (512, 700), (512, 780))
save(img, "lock.png")

# 11) 趋势/价值
img, d = canvas()
line(d, (200, 840), (860, 840))
d.line([(240, 700), (420, 520), (560, 620), (800, 300)], fill=INK, width=LW, joint="curve")
d.polygon([(800, 300), (680, 300), (800, 420)], fill=INK)
save(img, "trend.png")

# 12) 团队
img, d = canvas()
d.ellipse((400, 180, 624, 404), outline=INK, width=LW)
d.arc((280, 470, 744, 900), start=180, end=360, fill=INK, width=LW)
d.ellipse((150, 300, 330, 480), outline=INK, width=LW)
d.arc((60, 540, 420, 870), start=200, end=320, fill=INK, width=LW)
d.ellipse((694, 300, 874, 480), outline=INK, width=LW)
d.arc((604, 540, 964, 870), start=220, end=340, fill=INK, width=LW)
save(img, "team.png")

# 13) 旗/方案
img, d = canvas()
line(d, (300, 160), (300, 880))
d.polygon([(300, 200), (820, 340), (300, 520)], fill=INK)
save(img, "flag.png")

# 14) 烧瓶/实验（微调 A/B）
img, d = canvas()
d.polygon([(392, 170), (632, 170), (632, 300), (760, 800), (264, 800), (392, 300)], outline=INK, width=LW)
line(d, (360, 170), (664, 170))
line(d, (330, 640), (694, 640))
save(img, "flask.png")

# 15) 分层/差异化
img, d = canvas()
rounded(d, (200, 300, 620, 560), 50)
rounded(d, (404, 560, 824, 820), 50)
save(img, "layers.png")

print("图标已生成 ->", OUT, len(os.listdir(OUT)), "个")
