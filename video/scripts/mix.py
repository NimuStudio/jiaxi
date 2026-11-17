# -*- coding: utf-8 -*-
"""自己混音轨：旁白按 timing.json 逐句摆位 + 配乐铺底，输出 out/mix.wav。

为什么不用 Remotion 混：Remotion 里 bgm 只有一个 volume 旋钮，
改一次电平就要整片重渲（20 分钟）。这里直接算：改电平只要 1 分钟，
再用 ffmpeg -c:v copy 换掉音轨即可。

    python scripts/mix.py
    ffmpeg -y -i out/0-film.mp4 -i out/mix.wav -c:v copy -map 0:v -map 1:a out/0-film-audio.mp4
"""
import json
import os
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
FPS = 30
SR = 44100
BGM_GAIN = 0.18      # 目标：配乐比旁白低约 9 dB（104BPM funk groove，实测干声 RMS 校准）
NARR_PEAK = 0.85     # 旁白峰值压到 -1.4 dBFS，留 headroom


def to_wav(src, dst):
    if os.path.exists(dst):
        return dst
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", src, "-ac", "2", "-ar", str(SR), dst], check=True)
    return dst


def tile_with_crossfade(a, n, fade_s=1.5):
    """把配乐循环铺到整片长度。

    原文件只有 168 秒，片子 372 秒——不铺的话后半段完全没音乐。
    循环点用等功率交叉淡化，避免出现可听的接缝。
    """
    if len(a) >= n:
        return a[:n]
    fade = int(fade_s * SR)
    out = a.copy()
    while len(out) < n:
        tail = out[-fade:]
        ramp = np.linspace(0, 1, fade)[:, None]
        head = a[:fade]
        if len(head) < fade:
            out = np.concatenate([out, a])
            continue
        blended = tail * (1 - ramp) + head * ramp
        out = np.concatenate([out[:-fade], blended, a[fade:]])
    return out[:n]


def read_wav(path):
    w = wave.open(path)
    a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
    return a.reshape(-1, w.getnchannels())


def main():
    timing = json.load(open(os.path.join(VIDEO, "src", "timing.json"), encoding="utf-8"))
    total_frames = timing["totalFrames"]
    n = int(total_frames / FPS * SR) + SR  # 尾部留 1 秒
    narr = np.zeros((n, 2), dtype=np.float32)

    tmp = os.path.join(VIDEO, "out", "ma")
    os.makedirs(tmp, exist_ok=True)

    cursor = 0
    for b in timing["blocks"]:
        for ln in b["lines"]:
            src = os.path.join(VIDEO, "public", "audio", ln["file"])
            dst = os.path.join(tmp, ln["file"].replace(".mp3", ".wav"))
            a = read_wav(to_wav(src, dst))
            off = int(cursor / FPS * SR)
            end = min(n, off + len(a))
            narr[off:end] += a[: end - off]
            cursor += ln["frames"]

    bgm = read_wav(to_wav(os.path.join(VIDEO, "public", "audio", "bgm.mp3"),
                          os.path.join(tmp, "bgm_full.wav")))
    bgm = tile_with_crossfade(bgm, n, fade_s=1.5)
    bgm = bgm[:n] * BGM_GAIN

    mix = narr + bgm
    peak = float(np.abs(mix).max())
    if peak > NARR_PEAK:
        mix *= NARR_PEAK / peak

    out = os.path.join(VIDEO, "out", "mix.wav")
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    def rms(x):
        return 20 * np.log10(max(float(np.sqrt((x ** 2).mean())), 1e-9))

    print(f"旁白干声 RMS {rms(narr):.1f}  配乐干声 RMS {rms(bgm):.1f}  "
          f"差 {rms(narr) - rms(bgm):.1f} dB")
    print(f"混合 -> {out}  {len(mix)/SR:.2f}s  RMS {rms(mix):.1f} dBFS  "
          f"peak {20*np.log10(max(peak,1e-9)):.1f} dBFS")


FFMPEG = os.environ.get("FFMPEG", "")

if __name__ == "__main__":
    main()
