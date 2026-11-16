# -*- coding: utf-8 -*-
"""把 narration.json 逐句合成配音，并输出真实时长给 Remotion 用。

为什么逐句合成：分镜的时间轴不该是手写秒数，而是音频真实时长。
改一句文案 → 重跑本脚本 → timing.json 更新 → 视频时长自动跟着变。

    python scripts/tts.py            # 全量合成
    python scripts/tts.py --force     # 忽略缓存重新合成
"""
import argparse
import asyncio
import json
import os
import sys

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
AUDIO = os.path.join(VIDEO, "public", "audio")   # 必须落在 public/ 里，Remotion 用 staticFile 取
SCRIPT = os.path.join(VIDEO, "script", "narration.json")
TIMING = os.path.join(VIDEO, "src", "timing.json")
FPS = 30


async def synth(text, voice, rate, path):
    """合成一句话；返回 MP3 字节数（时长由 mutagen 之外的方式另行统计）。"""
    comm = edge_tts.Communicate(text, voice, rate=rate)
    buf = bytearray()
    meta = {"end": 0.0}
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
                buf.extend(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offset/duration 单位为 100ns
                meta["end"] = max(
                    meta["end"],
                    (chunk["offset"] + chunk["duration"]) / 10_000_000,
                )
    return buf, meta["end"]


def probe_duration(path):
    """用 mutagen 兜底取时长；没装就退回按码率估算。"""
    try:
        from mutagen.mp3 import MP3
        return MP3(path).info.length
    except Exception:
        size = os.path.getsize(path)
        return size / (24 * 1000 / 8)      # 24kbps 估算


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    with open(SCRIPT, encoding="utf-8") as f:
        spec = json.load(f)
    voice, rate = spec["voice"], spec.get("rate", "+0%")
    os.makedirs(AUDIO, exist_ok=True)

    out = {"fps": FPS, "voice": voice, "rate": rate, "blocks": []}
    total = 0.0
    n = 0
    for block in spec["blocks"]:
        blk = {"id": block["id"], "title": block["title"], "lines": []}
        for i, text in enumerate(block["lines"]):
            n += 1
            name = f"{n:02d}-{block['id']}-{i + 1}.mp3"
            path = os.path.join(AUDIO, name)
            if not os.path.exists(path) or args.force:
                _, spoken = asyncio.run(synth(text, voice, rate, path))
            else:
                spoken = 0.0
            sec = probe_duration(path)
            frames = int(round(sec * FPS))
            blk["lines"].append({"text": text, "file": name, "sec": round(sec, 3),
                                 "frames": frames})
            total += sec
            print(f"  {name}  {sec:6.2f}s  {text[:24]}")
        blk["sec"] = round(sum(l["sec"] for l in blk["lines"]), 3)
        blk["frames"] = sum(l["frames"] for l in blk["lines"])
        out["blocks"].append(blk)

    out["totalSec"] = round(total, 3)
    out["totalFrames"] = sum(b["frames"] for b in out["blocks"])
    with open(TIMING, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\n合计 {total:.1f} s（{total/60:.2f} 分）/ {out['totalFrames']} 帧 → {TIMING}")


if __name__ == "__main__":
    main()
