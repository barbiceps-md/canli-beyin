#!/usr/bin/env python3
"""Ateşleme isabetini ölçer.

precision = doğru ateşlenen / toplam ateşlenen
recall    = beklenen ve ateşlenen / beklenen

⚠️ RECALL ASLA DÜŞMEMELİ. Güvenlik kuralı kaçırmak, gürültüden çok daha kötü.
"""
import subprocess, sys, os, re

KUME = os.environ.get('KUME') or os.path.join(os.path.dirname(__file__), 'kume.tsv')
BEYIN = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', 'hafiza', 'bin', 'beyin')

def ates(cumle):
    r = subprocess.run(([sys.executable] if os.name == 'nt' else []) + [BEYIN, 'ates', cumle], capture_output=True, text=True, encoding='utf-8')
    return [m.group(1) for m in re.finditer(r'^─── ([a-z0-9-]+)', r.stdout, re.M)]

dogru = yanlis = kacan = 0
ayrinti = []
for satir in open(KUME, encoding='utf-8'):
    if satir.startswith('#') or not satir.strip():
        continue
    parca = satir.rstrip('\n').split('\t')
    cumle = parca[0]
    beklenen = {x.strip() for x in (parca[1] if len(parca) > 1 else '').split(',') if x.strip()}
    kabul    = {x.strip() for x in (parca[2] if len(parca) > 2 else '').split(',') if x.strip()}
    gelen = set(ates(cumle))
    d = gelen & beklenen
    y = gelen - beklenen - kabul      # kabul edilebilirler cezalandırılmaz
    k = beklenen - gelen
    dogru += len(d); yanlis += len(y); kacan += len(k)
    if y or k:
        ayrinti.append((cumle, sorted(y), sorted(k)))

top = dogru + yanlis
p = dogru / top * 100 if top else 100.0
r = dogru / (dogru + kacan) * 100 if (dogru + kacan) else 100.0
print(f'  ateşlenen toplam : {top}')
print(f'  doğru            : {dogru}')
print(f'  GÜRÜLTÜ          : {yanlis}')
print(f'  KAÇAN (kritik)   : {kacan}')
print(f'\n  isabet (precision): {p:.1f}%')
print(f'  recall            : {r:.1f}%')
if ayrinti:
    print('\n  ── sorunlar ──')
    for c, y, k in ayrinti:
        if k: print(f'    ✗ KAÇTI  "{c[:44]}" → {k}')
        if y: print(f'    · gürültü "{c[:44]}" → {y}')
sys.exit(0 if (p == 100.0 and r == 100.0) else 1)
