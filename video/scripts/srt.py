# -*- coding: utf-8 -*-
"""由 timing.json 生成字幕：src/subtitles.json（给 Remotion）与 out/film.srt（外挂备用）。

每句字幕 = 这句配音的真实起止帧，不手写时间。

    python scripts/srt.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.dirname(HERE)
TIMING = os.path.join(VIDEO, 'src', 'timing.json')
OUT_JSON = os.path.join(VIDEO, 'src', 'subtitles.json')
OUT_SRT = os.path.join(VIDEO, 'out', 'film.srt')
FPS = 30


def srt_time(frames):
    ms = int(round(frames * 1000 / FPS))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return "%02d:%02d:%02d,%03d" % (h, m, s, ms)


def main():
    t = json.load(open(TIMING, encoding='utf-8'))
    subs, cursor = [], 0
    for b in t['blocks']:
        for ln in b['lines']:
            subs.append({'start': cursor, 'end': cursor + ln['frames'], 'text': ln['text']})
            cursor += ln['frames']
    json.dump(subs, open(OUT_JSON, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    os.makedirs(os.path.dirname(OUT_SRT), exist_ok=True)
    with open(OUT_SRT, 'w', encoding='utf-8') as f:
        for i, s in enumerate(subs, 1):
            f.write('%d\n%s --> %s\n%s\n\n' % (i, srt_time(s['start']), srt_time(s['end']), s['text']))

    print("字幕 %d 条 -> %s / %s" % (len(subs), OUT_JSON, OUT_SRT))


if __name__ == '__main__':
    main()