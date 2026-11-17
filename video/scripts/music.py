# -*- coding: utf-8 -*-
"""合成一段 NCS 风格的电子配乐（无版权，纯数学生成）。

参照「科技数码区 UP 主常用 BGM」的通用结构——那类曲子几乎都是同一套骨架：
  128 BPM、A 小调、四拍底鼓、offbeat 开镲、2/4 拍 clap、
  **侧链压缩的 supersaw pad（pumping）**、16 分琶音主音、8 小节一段的推进。
这段不是抄某首曲子，而是把这套骨架自己合成出来，避免版权问题。

段落（每段 8 小节，1 小节 = 4 拍）：
  intro   只有 pad + 开镲（滤波渐开）
  build   加底鼓与 8 分贝斯
  drop    全开：底鼓 + clap + 16 分 hat + 琶音 + 侧链 pad
  break   撤底鼓，留 pad + 琶音（呼吸段）

    python scripts/music.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "audio", "bgm.wav")
SR = 44100
DUR = 168.0
BPM = 128.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
FADE = 2.0

# A 小调：Am - F - C - G
CHORDS = [
    (220.00, 261.63, 329.63),
    (174.61, 220.00, 261.63),
    (261.63, 329.63, 392.00),
    (196.00, 246.94, 293.66),
]


def sidechain(n, depth=0.65):
    """每拍开头被压下去再弹回来——这就是「pumping」，电子乐的标志性呼吸。"""
    t = np.arange(n) / SR
    phase = (t % BEAT) / BEAT
    return 1.0 - depth * np.exp(-phase * 7.0)


def saw(freq, n, detune=0.0, voices=3):
    """supersaw：几个轻微失谐的锯齿叠加，宽度来自失谐而不是混响。"""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for v in range(voices):
        f = freq * (1 + (v - (voices - 1) / 2) * detune)
        w = 2 * np.pi * f * t
        out += sum(np.sin(k * w) / k for k in range(1, 6))
    return out / voices


def kick(n):
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 26) + 45
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9.0)
    click = np.random.default_rng(3).standard_normal(n) * np.exp(-t * 400) * 0.25
    return body + click


def clap(n):
    rng = np.random.default_rng(5)
    t = np.arange(n) / SR
    env = np.exp(-t * 28) * (1 - np.exp(-t * 600))
    return rng.standard_normal(n) * env * 0.7


def hat(n, open_=False):
    rng = np.random.default_rng(9)
    t = np.arange(n) / SR
    env = np.exp(-t * (9 if open_ else 60))
    return rng.standard_normal(n) * env * (0.55 if open_ else 0.30)


def riser(n):
    rng = np.random.default_rng(13)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    y = 0.0
    a = 0.005 + 0.45 * (t / max(t[-1], 1e-9))
    for i in range(n):
        y += a[i] * (noise[i] - y)
        out[i] = y
    return out * np.linspace(0, 1, n) ** 2.2


def main():
    n_total = int(SR * DUR)
    left = np.zeros(n_total)
    right = np.zeros(n_total)
    n_beat = int(BEAT * SR)
    n8 = int(BEAT / 2 * SR)
    n16 = int(BEAT / 4 * SR)

    sections = ["intro", "build", "drop", "break"]
    bars_per_section = 8
    bar_index = 0
    pos = 0.0

    while pos < DUR - BAR:
        section = sections[(bar_index // bars_per_section) % len(sections)]
        chord = CHORDS[(bar_index // 2) % len(CHORDS)]
        start = int(pos * SR)
        end = min(n_total, int((pos + BAR) * SR))
        seg_n = end - start
        if seg_n <= 0:
            break

        # pad：supersaw + 侧链，drop 段最厚
        pad_gain = {"intro": 0.16, "build": 0.18, "drop": 0.22, "break": 0.20}[section]
        sc = sidechain(seg_n, depth=0.65 if section in ("build", "drop") else 0.25)
        for f in chord:
            left[start:end] += saw(f, seg_n, detune=0.004) * sc * pad_gain
            right[start:end] += saw(f * 1.002, seg_n, detune=0.004) * sc * pad_gain

        # 底鼓：build/drop 四拍全打
        if section in ("build", "drop"):
            for k in range(4):
                a = start + k * n_beat
                if a + n_beat >= n_total:
                    break
                kd = kick(n_beat) * 0.55
                left[a : a + n_beat] += kd
                right[a : a + n_beat] += kd

        # clap：2、4 拍
        if section == "drop":
            for k in (1, 3):
                a = start + k * n_beat
                if a + n_beat >= n_total:
                    break
                cp = clap(n_beat) * 0.28
                left[a : a + n_beat] += cp
                right[a : a + n_beat] += cp

        # hat：8 分反拍开镲 + 16 分闭镲
        for k in range(8):
            a = start + k * n8
            if a + n8 >= n_total:
                break
            is_off = k % 2 == 1
            if is_off:
                h = hat(n8, open_=True) * 0.22
                left[a : a + n8] += h
                right[a : a + n8] += h * 0.9
            elif section == "drop":
                for j in range(2):
                    b = a + j * n16
                    if b + n16 < n_total:
                        hh = hat(n16) * 0.12
                        left[b : b + n16] += hh
                        right[b : b + n16] += hh

        # 贝斯：8 分音符根音，跟着侧链走
        if section in ("build", "drop", "break"):
            for k in range(8):
                a = start + k * n8
                if a + n8 >= n_total:
                    break
                b = saw(chord[0] / 2, n8, detune=0.0, voices=1) * np.exp(-np.arange(n8) / SR * 12.0)
                left[a : a + n8] += b * 0.34
                right[a : a + n8] += b * 0.34

        # 琶音主音：drop 段 16 分，break 段 8 分
        if section in ("drop", "break"):
            step = n16 if section == "drop" else n8
            count = 16 if section == "drop" else 8
            pattern = [0, 1, 2, 1]
            for k in range(count):
                a = start + k * step
                if a + step >= n_total:
                    break
                f = chord[pattern[k % len(pattern)]] * 2
                t = np.arange(step) / SR
                env = np.exp(-t * 22.0) * (1 - np.exp(-t * 1200.0))
                tone = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env
                g = 0.26
                if k % 2 == 0:
                    left[a : a + step] += tone * g
                    right[a : a + step] += tone * g * 0.6
                else:
                    right[a : a + step] += tone * g
                    left[a : a + step] += tone * g * 0.6

        # 段落交界：riser + 一拍空拍感
        if (bar_index + 1) % bars_per_section == 0:
            seg = riser(int(2 * BEAT * SR)) * 0.18
            a = end - len(seg)
            if a > 0:
                left[a : a + len(seg)] += seg
                right[a : a + len(seg)] += seg

        pos += BAR
        bar_index += 1

    # 只做极短去刺耳（12 采样 ≈ 0.27ms，截止 5k 以上）
    kern = np.ones(12) / 12
    left = np.convolve(left, kern, mode="same")
    right = np.convolve(right, kern, mode="same")

    fn = int(FADE * SR)
    for ch in (left, right):
        ch[:fn] *= np.linspace(0, 1, fn)
        ch[-fn:] *= np.linspace(1, 0, fn)

    data = np.stack([left, right], axis=1)
    data /= max(1e-9, np.abs(data).max())
    data *= 0.42
    pcm = (data * 32767).astype("<i2")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("配乐 ->", OUT, f"{DUR:.0f}s  {BPM:.0f}BPM A minor NCS-style")


if __name__ == "__main__":
    main()
