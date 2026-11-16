# -*- coding: utf-8 -*-
"""合成一段极简 ambient 配乐（无版权，纯数学生成）。

为什么自己合成：素材站音乐要授权，免费库质量参差；而这段片子的情绪只需要
「不抢解说的低频铺底」——正弦叠加的 pad 就够，还能精确控制时长与淡入淡出。

    python scripts/music.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "audio", "bgm.wav")
SR = 44100
DUR = 168.0          # 略长于成片，剪辑时留余量
FADE = 3.0


def pad(freq, t, detune=0.0):
    """三个正弦叠一点轻微失谐，听起来更「厚」。"""
    return sum(
        np.sin(2 * np.pi * freq * (1 + k * detune) * t)
        for k in (-1, 0, 1)
    ) / 3.0


def main():
    n = int(SR * DUR)
    t = np.arange(n) / SR
    # 和弦进行：Am - F - C - G（低频铺底，避免和语音抢中频）
    chords = [
        (110.00, 164.81, 220.00),   # A2 E3 A3
        (87.31, 130.81, 174.61),    # F2 C3 F3
        (130.81, 196.00, 261.63),   # C3 G3 C4
        (98.00, 146.83, 196.00),    # G2 D3 G3
    ]
    seg = DUR / len(chords)
    left = np.zeros(n)
    right = np.zeros(n)
    for i, ch in enumerate(chords):
        a, b = int(i * seg * SR), int(min(DUR, (i + 1) * seg) * SR)
        tt = t[: b - a]
        env = np.ones(b - a)
        ramp = int(1.6 * SR)
        env[:ramp] = np.linspace(0, 1, ramp)
        env[-ramp:] = np.linspace(1, 0, ramp)
        sig = sum(pad(f, tt, detune=0.0009) for f in ch) / len(ch)
        left[a:b] += sig * env
        right[a:b] += sig * env * 0.96

    # 整体淡入淡出 + 轻微低通（移动平均）
    k = int(0.02 * SR)
    kernel = np.ones(k) / k
    left = np.convolve(left, kernel, mode="same")
    right = np.convolve(right, kernel, mode="same")
    fade_n = int(FADE * SR)
    for ch in (left, right):
        ch[:fade_n] *= np.linspace(0, 1, fade_n)
        ch[-fade_n:] *= np.linspace(1, 0, fade_n)

    data = np.stack([left, right], axis=1)
    data /= max(1e-9, np.abs(data).max())
    data *= 0.30                       # 峰值压到 -10 dB，成片里再衰减
    pcm = (data * 32767).astype("<i2")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("配乐 ->", OUT, f"{DUR:.0f}s")


if __name__ == "__main__":
    main()
