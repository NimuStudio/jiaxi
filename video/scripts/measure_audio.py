# -*- coding: utf-8 -*-
"""量一下配乐、旁白、成片的相对电平（RMS dBFS）。

这台机器的 ffmpeg 没编进 volumedetect，所以自己算：
ffmpeg 转 16k 单声道 wav → numpy 求 RMS 与峰值。

    python scripts/measure_audio.py
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
MA = os.path.join(VIDEO, "out", "ma")


def rms(path):
    w = wave.open(path)
    a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    r = float(np.sqrt((a ** 2).mean()))
    p = float(np.abs(a).max())
    return 20 * np.log10(max(r, 1e-9)), 20 * np.log10(max(p, 1e-9))


for name, f in [("bgm", "bgm.wav"), ("narration", "n1.wav"), ("film", "film.wav")]:
    p = os.path.join(MA, f)
    if os.path.exists(p):
        r, pk = rms(p)
        print(f"{name:10s} RMS {r:6.1f} dBFS   peak {pk:6.1f} dBFS")
