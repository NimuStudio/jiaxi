# -*- coding: utf-8 -*-
"""合成一段 funk / 复古律动配乐（无版权，纯数学生成）。

依据是什么：参考的数码区 BGM 合集里，十首以上是 funk/disco 律动
（Brass Mirage、Groovy City、Fresh Funky Juice、Funk Caravan、Lift Off…），
不是 NCS trance。所以这一版换成 funk 织体：

  104 BPM · A Dorian（Am7 - D9 两小节一换）· 轻微 swing
  1. 切分贝斯：16 分音符错位，八度跳，短促包络（funk 的骨架）
  2. 铜管 stab：锯齿堆叠 + 快速 attack / 短衰减，打在反拍「&」上
  3. 电钢声部：三和弦短音，带轻微颤音，铺在中频
  4. 鼓：1 拍与 2/3 的反拍底鼓，2、4 拍 snare，16 分 hi-hat 重音错位
  5. 每 8 小节加一次 open hat 收尾

    python scripts/music.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "public", "audio", "bgm.wav")
SR = 44100
DUR = 168.0
BPM = 104.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
SWING = 0.16          # 反拍 16 分音符延后比例
FADE = 2.0

# A Dorian：Am7 → D9，两小节一换
CHORDS = [
    (110.00, 261.63, 329.63, 392.00),   # A2 C4 E4 G4
    (146.83, 261.63, 293.66, 329.63),   # D3 C4 D4 E4
]

# 16 步一格：x=击打，.=空
BASS = "x..x..x.x..x..x."
STAB = "..x...x...x...x."
HATS = "x.xxx.xxx.xxx.xx"


def env_pluck(n, decay=18.0):
    t = np.arange(n) / SR
    return np.exp(-t * decay) * (1 - np.exp(-t * 900.0))


def bass_tone(freq, n):
    """贝斯：正弦 + 三次谐波，短包络，听起来是「弹」而不是「拉」。"""
    t = np.arange(n) / SR
    w = 2 * np.pi * freq * t
    return (np.sin(w) + 0.35 * np.sin(3 * w)) * env_pluck(n, 22.0)


def brass(freq, n):
    """铜管 stab：多个失谐锯齿 + 稍慢 attack。"""
    t = np.arange(n) / SR
    out = np.zeros(n)
    for det in (-0.004, 0.0, 0.004):
        w = 2 * np.pi * freq * (1 + det) * t
        out += sum(np.sin(k * w) / k for k in range(1, 7))
    attack = 1 - np.exp(-t * 260)
    return out / 3 * attack * np.exp(-t * 13.0)


def epiano(freq, n):
    t = np.arange(n) / SR
    w = 2 * np.pi * freq * t
    trem = 1 + 0.15 * np.sin(2 * np.pi * 5.5 * t)
    return (np.sin(w) + 0.25 * np.sin(2 * w)) * np.exp(-t * 7.0) * trem


def kick(n):
    t = np.arange(n) / SR
    f = 105 * np.exp(-t * 28) + 48
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11.0)


def snare(n):
    rng = np.random.default_rng(17)
    t = np.arange(n) / SR
    return rng.standard_normal(n) * np.exp(-t * 30) * 0.8


def hat(n, acc=1.0):
    rng = np.random.default_rng(19)
    t = np.arange(n) / SR
    return rng.standard_normal(n) * np.exp(-t * 70) * 0.28 * acc


def main():
    n_total = int(SR * DUR)
    left = np.zeros(n_total)
    right = np.zeros(n_total)
    step = BEAT / 4
    n_step = int(step * SR)

    bar = 0
    pos = 0.0
    while pos < DUR - BAR:
        chord = CHORDS[(bar // 2) % len(CHORDS)]
        root = chord[0]

        for k in range(16):
            # swing：奇数 16 分音符往后挪
            t0 = pos + k * step + (SWING * step if k % 2 == 1 else 0)
            a = int(t0 * SR)
            if a + n_step >= n_total:
                continue

            if BASS[k] == "x":
                octave = 2 if k in (6, 14) else 1     # 八度跳是 funk 的味道
                tone = bass_tone(root * octave, n_step) * 0.40
                left[a : a + n_step] += tone
                right[a : a + n_step] += tone

            if STAB[k] == "x":
                for f in chord[1:]:
                    st = brass(f, n_step) * 0.12
                    left[a : a + n_step] += st
                    right[a : a + n_step] += st * 0.92

            if HATS[k] == "x":
                acc = 1.0 if k % 4 == 0 else 0.55
                h = hat(n_step, acc)
                left[a : a + n_step] += h
                right[a : a + n_step] += h * 0.85

            if k in (2, 6, 10, 14) and k % 4 == 2:
                kd = kick(n_step) * 0.30
                left[a : a + n_step] += kd
                right[a : a + n_step] += kd
            if k == 0:
                kd = kick(n_step) * 0.45
                left[a : a + n_step] += kd
                right[a : a + n_step] += kd
            if k in (4, 12):
                sn = snare(n_step) * 0.26
                left[a : a + n_step] += sn
                right[a : a + n_step] += sn

        # 电钢：每小节两个长音
        for i, off in enumerate((0, 2 * BEAT)):
            a = int((pos + off) * SR)
            ln = int(1.6 * BEAT * SR)
            if a + ln >= n_total:
                continue
            seg = epiano(chord[2], ln) * 0.10
            left[a : a + ln] += seg
            right[a : a + ln] += seg * 0.95

        # 每 8 小节一次 open hat
        if bar % 8 == 7:
            a = int((pos + 3.5 * BEAT) * SR)
            if a + n_step < n_total:
                oh = hat(int(0.6 * SR), 1.0) * 0.30
                left[a : a + len(oh)] += oh
                right[a : a + len(oh)] += oh

        pos += BAR
        bar += 1

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
    print("配乐 ->", OUT, f"{DUR:.0f}s  {BPM:.0f}BPM A Dorian funk groove")


if __name__ == "__main__":
    main()
