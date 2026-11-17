# -*- coding: utf-8 -*-
"""配乐的客观指标：亮度与节拍。

纯 sine pad 几乎没有 1kHz 以上能量；NCS 风格（四拍底鼓 + 开镲 + 琶音）应该明显更亮、节拍更强。
节拍用自相关在 70-170 BPM 范围搜峰值，不写死 BPM，避免换曲后指标失真。
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
print(f"频谱重心 {float((spec*freqs).sum()/spec.sum()):6.0f} Hz   "
      f"1kHz 以上能量 {float(spec[freqs>1000].sum()/spec.sum())*100:4.1f}%")

step = 0.01
env = np.abs(a)
env = np.convolve(env, np.ones(int(step * sr)) / int(step * sr), mode="same")[:: int(step * sr)]
env = env - env.mean()
ac = np.correlate(env, env, mode="full")[len(env) - 1 :]
ac /= ac[0]

lo, hi = int(60 / 170 / step), int(60 / 70 / step)
lag = lo + int(np.argmax(ac[lo:hi]))
print(f"节拍自相关峰值 {ac[lag]:.2f} @ {60/(lag*step):.0f} BPM")
