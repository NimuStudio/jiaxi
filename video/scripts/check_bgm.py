# -*- coding: utf-8 -*-
"""看一眼配乐的「科技感」指标：高频占比与节拍脉冲。

纯正弦 pad 几乎没有 1kHz 以上能量；加了琶音与 hi-hat 后应明显抬高。
同时验证 108 BPM 的 8 分音符脉冲确实存在（自相关在 0.278s 处出峰）。
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
p = os.path.join(VIDEO, "out", "ma", "bgm.wav")

w = wave.open(p)
sr = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768

seg = a[int(20 * sr) : int(35 * sr)]
spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
freqs = np.fft.rfftfreq(len(seg), 1 / sr)
centroid = (spec * freqs).sum() / spec.sum()
hi = spec[freqs > 1000].sum() / spec.sum()
print(f"频谱重心 {centroid:6.0f} Hz   1kHz 以上能量占比 {hi*100:4.1f}%")

# 包络自相关找节拍
env = np.abs(a)
win = int(0.01 * sr)
env = np.convolve(env, np.ones(win) / win, mode="same")[:: win]
env = env - env.mean()
ac = np.correlate(env, env, mode="full")[len(env) - 1 :]
ac /= ac[0]
lag8 = int(round((60 / 108 / 2) / 0.01))
print(f"8 分音符({lag8*10}ms) 处自相关 {ac[lag8]:.2f}  ← >0.15 说明脉冲清楚")
