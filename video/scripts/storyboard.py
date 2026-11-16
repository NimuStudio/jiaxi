# -*- coding: utf-8 -*-
"""由 timing.json 生成分镜表（script.md）。

分镜里的秒数全部来自真实配音时长，手写秒数在这里是禁止的——
改了文案重跑 tts.py，本脚本重跑一次，表就自动对上。

    python scripts/storyboard.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
TIMING = os.path.join(VIDEO, "src", "timing.json")
OUT = os.path.join(VIDEO, "script.md")

VISUAL = {
    "hook": "黑底。三句话逐句打出（像听写）。最后一行淡出，浮出一张体检报告，红章「未见异常」。",
    "problem": "三联并置：①报告只有当期指标 ②问卷把家族史压成有/无 ③建议不给复算。每条配删除线动画。",
    "product": "白底工作台。一句口述 → 家系图节点逐个长出（三代）→ 每条病浮出「回查原文」小标签 → 空字段处 Agent 追问 → 三个数字落下。",
    "risk": "风险尺：33% 起，橙色段被逐段吃掉 → 17% → 4%；中段浮出「7 分 可回收」；末尾拆成「能改 / 改不了」。",
    "ai": "上半：一句话切成 tokens，落进 GBNF 允许的枚举槽（非法值被挡回）。下半：12 维信号 → 五个概率柱；右侧 40% vs 96% 对照条。",
    "evidence": "终端输出滚入（测试 → 留出集 → 接口）；右下角本机边界虚线框收紧，标注「数据不出这台机器」。",
    "close": "回到深色：三样交付物 + 一句话收束；片名与作品信息。",
}


def fmt(sec):
    m, s = divmod(sec, 60)
    return "%d:%05.2f" % (int(m), s)


def main():
    t = json.load(open(TIMING, encoding="utf-8"))
    rows, clock = [], 0.0
    for b in t["blocks"]:
        rows.append((b["id"], b["title"], clock, clock + b["sec"], b["sec"], b["lines"]))
        clock += b["sec"]

    L = []
    L.append('# 演示视频分镜 · 家系\n')
    L.append("> 配音 %s（rate %s）· 1920×1080 · %dfps · 共 **%d 块 / %d 句 / %.1f 秒（%.2f 分）**\n"
             % (t["voice"], t["rate"], t["fps"], len(t["blocks"]),
                sum(len(b["lines"]) for b in t["blocks"]), t["totalSec"], t["totalSec"] / 60))
    L.append("> 秒数由 scripts/tts.py 实测音频生成，scripts/storyboard.py 自动写回；"
             "改文案请改 script/narration.json 后重跑这两个脚本，**不要手改本文件的秒数**。\n")
    L.append("\n## 总表\n")
    L.append("| # | 章节 | 起 | 止 | 时长 | 画面 |")
    L.append("| --- | --- | --- | --- | --- | --- |")
    for i, (bid, title, a, b2, sec, lines) in enumerate(rows, 1):
        L.append("| %d | %s | %s | %s | %.1fs | %s |" % (i, title, fmt(a), fmt(b2), sec, VISUAL.get(bid, "-")))
    L.append("\n## 逐句解说\n")
    for i, (bid, title, a, b2, sec, lines) in enumerate(rows, 1):
        L.append("### %d　%s – %s　%s　（%.1fs）\n" % (i, fmt(a), fmt(b2), title, sec))
        L.append("**画面**：%s\n" % VISUAL.get(bid, "-"))
        for ln in lines:
            L.append("- %5.2fs  %s" % (ln["sec"], ln["text"]))
        L.append("")

    open(OUT, "w", encoding="utf-8").write("\n".join(L))
    print("分镜 -> %s（%d 块 / %.1fs）" % (OUT, len(rows), t["totalSec"]))


if __name__ == "__main__":
    main()