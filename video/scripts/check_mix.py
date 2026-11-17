# -*- coding: utf-8 -*-
"""检查成片音轨：0.5 秒窗口的 RMS 起伏。

判据：解说之间有停顿，若这些停顿处的 RMS 仍稳定在 -40 dBFS 上下，
说明配乐确实在铺底；如果掉到 -60 以下，等于没音乐。
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
p = os.path.join(VIDEO, "out", "ma", "film.wav")
w = wave.open(p)
sr = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768

win = int(0.5 * sr)
rms = np.array([20 * np.log10(max(float(np.sqrt((a[i:i + win] ** 2).mean())), 1e-9))
                for i in range(0, len(a) - win, win)])
print(f"窗口 {len(rms)} 个（0.5s）")
print(f"最大 {rms.max():.1f}  中位 {np.median(rms):.1f}  最小 {rms.min():.1f} dBFS")
print(f"最安静 10% 的中位 {np.percentile(rms, 10):.1f} dBFS  ← 停顿处的底噪/配乐")
