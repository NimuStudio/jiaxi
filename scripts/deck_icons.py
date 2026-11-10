# -*- coding: utf-8 -*-
"""家系答辩 PPT 的图标集（双色版）：程序绘制，4 倍超采样后缩放。

配色：主色描边 #1A6FB5 + 浅蓝填色 #D8E9F7（双色，比纯线框更精致也更有辨识度）。
规格：256x256 透明底。
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "docs", "deck-assets", "icons")
os.makedirs(OUT, exist_ok=True)

S = 1024
FINAL = 256
INK = (26, 111, 181, 255)
PALE = (210, 230, 246, 255)
LW = 52


def canvas():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def save(img, name):
    img.resize((FINAL, FINAL), Image.LANCZOS).save(os.path.join(OUT, name))


def line(d, p1, p2, w=LW, color=INK):
    d.line([p1, p2], fill=color, width=w, joint="curve")


def rrect(d, box, r, w=LW, fill=None):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=INK, width=w)


# --- mic ---
img, d = canvas()
rrect(d, (360, 220, 664, 610), 152, fill=PALE)
d.arc((300, 370, 724, 750), start=0, end=180, fill=INK, width=LW)
line(d, (512, 690), (512, 850)); line(d, (380, 850), (644, 850))
save(img, "mic.png")

# --- chat ---
img, d = canvas()
rrect(d, (180, 240, 844, 690), 90, fill=PALE)
d.polygon([(330, 680), (330, 820), (500, 680)], fill=PALE, outline=INK)
for cx in (380, 512, 644):
    d.ellipse((cx - 30, 435, cx + 30, 495), fill=INK)
save(img, "chat.png")

# --- tree（家系） ---
img, d = canvas()
rrect(d, (400, 150, 624, 330), 40, fill=PALE)
rrect(d, (170, 690, 394, 870), 40, fill=PALE)
rrect(d, (620, 690, 844, 870), 40, fill=PALE)
line(d, (512, 330), (512, 500)); line(d, (282, 500), (732, 500))
line(d, (282, 500), (282, 690)); line(d, (732, 500), (732, 690))
save(img, "tree.png")

# --- gauge ---
img, d = canvas()
d.pieslice((180, 230, 844, 894), start=180, end=360, fill=PALE)
d.arc((180, 230, 844, 894), start=180, end=360, fill=INK, width=LW)
line(d, (512, 610), (700, 390))
d.ellipse((455, 553, 569, 667), fill=INK)
line(d, (250, 610), (250, 690)); line(d, (774, 610), (774, 690))
save(img, "gauge.png")

# --- play ---
img, d = canvas()
d.ellipse((170, 170, 854, 854), fill=PALE, outline=INK, width=LW)
d.polygon([(430, 350), (430, 674), (720, 512)], fill=INK)
save(img, "play.png")

# --- chip ---
img, d = canvas()
rrect(d, (280, 280, 744, 744), 60, fill=PALE)
rrect(d, (440, 440, 584, 584), 30)
for t in (360, 512, 664):
    line(d, (t, 170), (t, 280)); line(d, (t, 744), (t, 854))
    line(d, (170, t), (280, t)); line(d, (744, t), (854, t))
save(img, "chip.png")

# --- calc ---
img, d = canvas()
rrect(d, (240, 150, 784, 874), 70, fill=PALE)
d.rectangle((340, 236, 684, 356), fill=INK)
for y in (480, 620, 760):
    for x in (370, 512, 654):
        d.ellipse((x - 34, y - 34, x + 34, y + 34), fill=INK)
save(img, "calc.png")

# --- target ---
img, d = canvas()
d.ellipse((212, 212, 812, 812), fill=PALE, outline=INK, width=LW)
d.ellipse((352, 352, 672, 672), outline=INK, width=LW)
d.ellipse((462, 462, 562, 562), fill=INK)
save(img, "target.png")

# --- balance ---
img, d = canvas()
d.polygon([(240, 300), (380, 470), (110, 470)], fill=PALE)
d.polygon([(784, 300), (914, 470), (654, 470)], fill=PALE)
line(d, (512, 190), (512, 800)); line(d, (250, 800), (774, 800))
line(d, (240, 320), (784, 320))
d.arc((110, 330, 380, 520), start=0, end=180, fill=INK, width=LW)
d.arc((654, 330, 914, 520), start=0, end=180, fill=INK, width=LW)
line(d, (240, 320), (240, 360)); line(d, (784, 320), (784, 360))
save(img, "balance.png")

# --- lock ---
img, d = canvas()
rrect(d, (250, 470, 774, 870), 70, fill=PALE)
d.arc((330, 170, 694, 560), start=180, end=360, fill=INK, width=LW)
line(d, (330, 466), (330, 556)); line(d, (694, 466), (694, 556))
d.ellipse((472, 610, 552, 690), fill=INK)
line(d, (512, 690), (512, 770))
save(img, "lock.png")

# --- trend ---
img, d = canvas()
d.polygon([(240, 700), (420, 520), (560, 620), (800, 300), (800, 840), (240, 840)], fill=PALE)
line(d, (200, 840), (860, 840))
d.line([(240, 700), (420, 520), (560, 620), (800, 300)], fill=INK, width=LW, joint="curve")
d.polygon([(800, 290), (668, 300), (790, 420)], fill=INK)
save(img, "trend.png")

# --- team ---
img, d = canvas()
d.ellipse((400, 180, 624, 404), fill=PALE, outline=INK, width=LW)
d.arc((280, 470, 744, 900), start=180, end=360, fill=INK, width=LW)
d.ellipse((150, 300, 330, 480), fill=PALE, outline=INK, width=LW)
d.arc((60, 540, 420, 870), start=200, end=320, fill=INK, width=LW)
d.ellipse((694, 300, 874, 480), fill=PALE, outline=INK, width=LW)
d.arc((604, 540, 964, 870), start=220, end=340, fill=INK, width=LW)
save(img, "team.png")

# --- flag ---
img, d = canvas()
d.polygon([(300, 200), (820, 340), (300, 520)], fill=PALE, outline=INK)
line(d, (300, 160), (300, 880))
save(img, "flag.png")

# --- flask ---
img, d = canvas()
d.polygon([(392, 170), (632, 170), (632, 300), (760, 800), (264, 800), (392, 300)],
          fill=PALE, outline=INK)
line(d, (360, 170), (664, 170))
line(d, (330, 640), (694, 640))
save(img, "flask.png")

# --- layers ---
img, d = canvas()
rrect(d, (200, 300, 620, 560), 50, fill=PALE)
rrect(d, (404, 560, 824, 820), 50)
save(img, "layers.png")

# --- camera（化验单拍照）---
img, d = canvas()
rrect(d, (170, 330, 854, 810), 60, fill=PALE)
d.rectangle((330, 270, 520, 350), fill=PALE, outline=INK, width=LW)
d.ellipse((390, 430, 634, 674), fill=(255, 255, 255, 255), outline=INK, width=LW)
d.ellipse((450, 500, 574, 624), fill=INK)
save(img, "camera.png")

# --- terminal（Agent 工具调用）---
# 齿轮试过：8 个齿叠在一起像病毒，不像工具。终端窗口语义更准，也更好认。
img, d = canvas()
rrect(d, (190, 270, 834, 770), 60, fill=PALE)
line(d, (330, 430), (430, 520)); line(d, (430, 520), (330, 610))
line(d, (520, 620), (700, 620))
save(img, "terminal.png")

# --- db（本机 MySQL）---
img, d = canvas()
d.ellipse((260, 200, 764, 400), fill=PALE, outline=INK, width=LW)
d.rectangle((260, 300, 764, 720), fill=PALE)
line(d, (260, 300), (260, 720)); line(d, (764, 300), (764, 720))
d.arc((260, 620, 764, 820), start=0, end=180, fill=INK, width=LW)
d.arc((260, 430, 764, 630), start=0, end=180, fill=INK, width=LW)
d.ellipse((260, 200, 764, 400), outline=INK, width=LW)
save(img, "db.png")

print("双色图标 ->", OUT, len(os.listdir(OUT)), "个")
