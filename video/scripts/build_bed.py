# -*- coding: utf-8 -*-
"""把几首 CC BY 4.0 的曲库短曲拼成一条「音乐床」。

为什么拼：incompetech 这些 cue 都是 35-55 秒的曲库素材，单曲循环 7 次会很单调；
把它们按能量顺序串起来（1.6 秒等功率交叉淡化），整条约 3 分钟，
再循环一次即可覆盖 6 分钟片子 —— 独特素材超过全片一半。

许可：Kevin MacLeod (incompetech.com)，CC BY 4.0，成片里必须署名。

    python scripts/build_bed.py
"""
import os
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
REF = os.path.join(VIDEO, "ref")
OUT = os.path.join(VIDEO, "public", "audio", "bed.wav")
SR = 44100
XFADE = 1.6
TRACKS = ["Funkorama.mp3", "Funk_Game_Loop.mp3", "Disco_Medusae.mp3", "Wallpaper.mp3"]
FFMPEG = os.environ.get("FFMPEG", "")


def load(name):
    src = os.path.join(REF, name)
    dst = os.path.join(REF, name.replace(".mp3", ".wav"))
    if not os.path.exists(dst):
        subprocess.run([FFMPEG, "-v", "error", "-y", "-i", src, "-ac", "2", "-ar", str(SR), dst], check=True)
    w = wave.open(dst)
    a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    return a.reshape(-1, 2)


def main():
    bed = None
    fade = int(XFADE * SR)
    for name in TRACKS:
        a = load(name)
        if bed is None:
            bed = a
            continue
        tail = bed[-fade:]
        head = a[:fade]
        ramp = np.linspace(0, 1, fade)[:, None]
        blended = tail * (1 - ramp) + head * ramp
        bed = np.concatenate([bed[:-fade], blended, a[fade:]])

    # 整条床再循环一次（1.6s 交叉），铺到片子长度
    need = int(373.0 * SR)
    one = bed
    while len(bed) < need:
        tail = bed[-fade:]
        head = one[:fade]
        ramp = np.linspace(0, 1, fade)[:, None]
        blended = tail * (1 - ramp) + head * ramp
        bed = np.concatenate([bed[:-fade], blended, one[fade:]])
    bed = bed[:need]

    peak = float(np.abs(bed).max())
    if peak > 0.9:
        bed *= 0.9 / peak

    pcm = (np.clip(bed, -1, 1) * 32767).astype("<i2")
    with wave.open(OUT, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    r = 20 * np.log10(max(float(np.sqrt((bed ** 2).mean())), 1e-9))
    print(f"音乐床 -> {OUT}  {len(bed)/SR:.1f}s  RMS {r:.1f} dBFS  peak {20*np.log10(max(peak,1e-9)):.1f} dBFS")


if __name__ == "__main__":
    main()
