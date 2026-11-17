import os, wave
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
p = os.path.join(os.path.dirname(HERE), "public", "audio", "bed.wav")
if not os.path.exists(p):
    print("(没有 bed.wav)"); raise SystemExit
w = wave.open(p); sr = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
a = a.mean(axis=1) if a.ndim > 1 else a
for t in (0.5, 1, 2, 3, 5, 7, 9, 12):
    seg = a[: int(t * sr)]
    r = 20 * np.log10(max(float(np.sqrt((seg ** 2).mean())), 1e-9))
    print(f"0-{t:4.1f}s  RMS {r:6.1f} dBFS")
