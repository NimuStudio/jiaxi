import json, glob
f = sorted(glob.glob('docs/eval-results/*colloquial-eval-v2.json'))[-1]
d = json.load(open(f, encoding='utf-8'))
print('file', f, 'n', d['n'], 'F1', round(d['f1'],3))
bad = [c for c in d['perCase'] if not c['exact']]
print('不完全匹配', len(bad))
for c in bad:
    print(' -', c['id'], '|', c['input'][:28], '| 缺', c['missing'], '| 多', c['extra'])