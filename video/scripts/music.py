# -*- coding: utf-8 -*-
"""合成一段「科技感」配乐（无版权，纯数学生成）。

不是换和弦，而是换织体。科技感来自四层叠加：
  1. 脉冲低音：锯齿感（1/n 谐波）8 分音符门控，A 小调根音；
  2. 琶音：16 分音符跑和弦音，短促包络 + 左右交替声场，这是「电子感」的主力；
  3. 铺底 pad：正弦三和弦，只做低频厚度，音量压到最低；
  4. 节奏：每 4 拍一次柔和底鼓（90→50Hz 扫频），8 分音符气声 hi-hat 极轻；
  5. 每 16 拍一次噪声上扬（riser），给段落推进感。

BPM 108，A 小调，和弦 Am–F–C–G，每个和弦 8 拍。

    python scripts/music.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "audio", "bgm.wav")
SR = 44100
DUR = 168.0
BPM = 108.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
FADE = 2.5

# A 小调：Am - F - C - G（根音, 三音, 五音）
CHORDS = [
    (220.00, 261.63, 329.63),
    (174.61, 220.00, 261.63),
    (261.63, 329.63, 392.00),
    (196.00, 246.94, 293.66),
]


def saw_bass(freq, n):
    w = 2 * np.pi * freq * np.arange(n) / SR
    return sum(np.sin(k * w) / k for k in (1, 2, 3, 4))


def pluck(freq, n):
    """短促琶音：指数衰减 + 二次谐波，像合成器拨弦。"""
    t = np.arange(n) / SR
    env = np.exp(-t * 26.0) * (1 - np.exp(-t * 900.0))
    w = 2 * np.pi * freq * t
    return (np.sin(w) + 0.35 * np.sin(2 * w)) * env


def kick(n):
    t = np.arange(n) / SR
    f = 90 * np.exp(-t * 22) + 48
    env = np.exp(-t * 12)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env


def hat(n):
    rng = np.random.default_rng(7)
    t = np.arange(n) / SR
    return rng.standard_normal(n) * np.exp(-t * 55.0) * 0.5


def riser(n):
    rng = np.random.default_rng(11)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # 一阶低通，截止随包络上移
    out = np.zeros(n)
    a = 0.02 + 0.5 * (t / max(t[-1], 1e-9))
    y = 0.0
    for i in range(n):
        y += a[i] * (noise[i] - y)
        out[i] = y
    return out * np.linspace(0, 1, n) ** 2


def main():
    n_total = int(SR * DUR)
    left = np.zeros(n_total)
    right = np.zeros(n_total)

    step16 = BEAT / 4
    n16 = int(step16 * SR)
    n8 = int(BEAT / 2 * SR)
    n_beat = int(BEAT * SR)

    chord_len = 8 * BEAT                 # 每个和弦 8 拍
    pos = 0.0
    ci = 0
    step_index = 0
    while pos < DUR - chord_len:
        chord = CHORDS[ci % len(CHORDS)]
        start = int(pos * SR)
        end = int((pos + chord_len) * SR)

        # 1. 脉冲低音：8 分音符门控
        for k in range(16):
            a = start + k * n8
            if a + n8 >= n_total:
                break
            seg = saw_bass(chord[0] / 2, n8)
            env = np.exp(-np.arange(n8) / SR * 9.0)
            left[a : a + n8] += seg * env * 0.30
            right[a : a + n8] += seg * env * 0.30

        # 2. 琶音：16 分音符，四个音循环，左右交替
        pattern = [0, 1, 2, 1]
        for k in range(32):
            a = start + k * n16
            if a + n16 >= n_total:
                break
            f = chord[pattern[k % len(pattern)]] * 2
            seg = pluck(f, n16)
            gain = 0.30
            if (k // 4) % 2 == 0:
                left[a : a + n16] += seg * gain
                right[a : a + n16] += seg * gain * 0.55
            else:
                right[a : a + n16] += seg * gain
                left[a : a + n16] += seg * gain * 0.55

        # 3. pad：整块铺底，音量最低
        seg_len = end - start
        t = np.arange(seg_len) / SR
        env = np.ones(seg_len)
        ramp = int(0.6 * SR)
        env[:ramp] = np.linspace(0, 1, ramp)
        env[-ramp:] = np.linspace(1, 0, ramp)
        pad = sum(np.sin(2 * np.pi * f * t) for f in chord) / 3
        left[start:end] += pad * env * 0.10
        right[start:end] += pad * env * 0.10

        # 4. 节奏：每 4 拍底鼓 + 8 分 hi-hat
        for k in range(8):
            a = start + k * n8
            if a + n8 < n_total:
                h = hat(n8) * 0.10
                left[a : a + n8] += h
                right[a : a + n8] += h
        for k in range(2):
            a = start + k * 2 * n_beat
            if a + n_beat < n_total:
                kd = kick(n_beat) * 0.32
                left[a : a + n_beat] += kd
                right[a : a + n_beat] += kd

        # 5. 每 16 拍一次上扬
        if ci % 2 == 1:
            a = start + 4 * n_beat
            seg = riser(int(4 * BEAT * SR)) * 0.05
            if a + len(seg) < n_total:
                left[a : a + len(seg)] += seg
                right[a : a + len(seg)] += seg

        pos += chord_len
        ci += 1

    # 轻微去刺耳：核长只取 12 个采样（≈0.27ms），截止在 5kHz 以上。
    # 之前用 4ms 滑动平均（等效截止 250Hz），把琶音和 hi-hat 全滤没了，频谱重心只剩 199Hz。
    k = 12
    kern = np.ones(k) / k
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
    print("配乐 ->", OUT, f"{DUR:.0f}s  {BPM:.0f}BPM A minor")


if __name__ == "__main__":
    main()
