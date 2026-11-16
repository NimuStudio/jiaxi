# -*- coding: utf-8 -*-
"""生成「纯线稿」家系图 PNG，供半调装饰使用。

export_tree.py 那份是产品图（实心节点 + 文字标注），直接做半调会糊成大色块。
这里只画线：圆、方框描边、连线，不填色、不写字 —— 半调后是细腻的点阵。
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "deck-assets",
                   "decor-pedigree.png")
W, H = 2000, 1400
S = 3                     # 线宽倍数，缩下来才不会断
INK = (20, 40, 60, 255)

img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

NODE = 70
LW = 4 * S


def sq(x, y):
    d.rectangle([x - NODE / 2, y - NODE / 2, x + NODE / 2, y + NODE / 2], outline=INK, width=LW)


def ci(x, y):
    d.ellipse([x - NODE / 2, y - NODE / 2, x + NODE / 2, y + NODE / 2], outline=INK, width=LW)


def ln(pts):
    d.line(pts, fill=INK, width=LW, joint="curve")


# 三代结构（只表达关系，不标注任何病名）
G1, G2, G3 = 380, 760, 1140
ln([(300, G1), (470, G1)])                       # 婚配
ln([(385, G1), (385, G2 - NODE / 2)])
sq(300, G1); ci(470, G1)
sq(385, G2)
# 旁系
ln([(760, G1 - 120), (760, G1 - 120)])
ci(760, G1)
ln([(760, G1 + NODE / 2), (760, G2 - 200)])
ln([(640, G2 - 200), (1080, G2 - 200)])
ln([(640, G2 - 200), (640, G2 - NODE / 2)])
ln([(1080, G2 - 200), (1080, G2 - NODE / 2)])
ci(640, G2); sq(1080, G2)
# 本人
ln([(470, G2), (880, G2)])
ln([(880, G2), (880, G3 - NODE / 2)])
sq(880, G3)
# 再来一层旁支，制造密度
ln([(1080, G2), (1290, G2)])
ln([(1290, G2), (1290, G3 - NODE / 2)])
ci(1290, G3)

img.save(OUT)
print("线稿 ->", os.path.abspath(OUT), img.size)
