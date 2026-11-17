# -*- coding: utf-8 -*-
"""合成一段 ambient 配乐（无版权，纯数学生成）。

第一版只有 110-260 Hz 的纯正弦垫：笔记本喇叭几乎发不出来，成片里等于没有。
这一版加了两样东西：
  1. 二、三次谐波（440-800 Hz 有能量，笔记本喇叭能出声）；
  2. 每 2 秒一次的柔和脉冲（像心跳），让音乐有节奏而不只是嗡鸣。

    python scripts/music.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "audio", "bgm.wav")
SR = 44100
DUR = 168.0
FADE = 3.0
PULSE_BEAT = 2.0      # 秒


def voice(freq, t):
    """基频 + 二三次谐波，谐波权重递减。"""
    w = 2 * np.pi * freq * t
    return np.sin(w) + 0.45 * np.sin(2 * w) + 0.22 * np.sin(3 * w)


def main():
    n = int(SR * DUR)
    t = np.arange(n) / SR

    chords = [
        (110.00, 164.81, 220.00),   # Am
        (87.31, 130.81, 174.61),    # F
        (130.81, 196.00, 261.63),   # C
        (98.00, 146.83, 196.00),    # G
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
        sig = sum(voice(f, tt) for f in ch) / len(ch)
        left[a:b] += sig * env
        right[a:b] += sig * env * 0.94

    # 柔和脉冲：低频正弦包络，每 2 秒一次，不抢解说
    beat = np.zeros(n)
    period = PULSE_BEAT
    for start in np.arange(0, DUR, period):
        a = int(start * SR)
        length = min(int(0.45 * SR), n - a)
        if length <= 0:
            continue
        tt = np.arange(length) / SR
        env = np.exp(-tt * 7.0) * (1 - np.exp(-tt * 120.0))
        beat[a : a + length] += np.sin(2 * np.pi * 55 * tt) * env * 0.55

    left += beat
    right += beat

    # 轻微低通，去掉数字刺耳感
    k = int(0.006 * SR)
    kernel = np.ones(k) / k
    left = np.convolve(left, kernel, mode="same")
    right = np.convolve(right, kernel, mode="same")

    fade_n = int(FADE * SR)
    for ch in (left, right):
        ch[:fade_n] *= np.linspace(0, 1, fade_n)
        ch[-fade_n:] *= np.linspace(1, 0, fade_n)

    data = np.stack([left, right], axis=1)
    data /= max(1e-9, np.abs(data).max())
    data *= 0.42                     # 峰值约 -7.5 dB，成片里再按 0.35 压
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
