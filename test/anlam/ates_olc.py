#!/usr/bin/env python3
"""`beyin ates` çıktısını sınav kümesiyle ölçer (eski ve yeni sürüm aynı ölçüyle).

Hedefli küme (TSV):  <hedef id> \t <çeşit> \t <mesaj>
    → hedef GÖSTERİLDİ mi (gövdesi basıldı), adı anıldı mı (gösterilmedi listesi),
      mesaj başına kaç nöron basıldı.
Genel küme (TSV):    <mesaj> \t \t <kabul edilebilir id'ler>    (ZORUNLU yok)
    → kabul dışı her basılan nöron gürültü.

Kullanım: ates_olc.py <beyin yolu> <kume.tsv> [--genel] [--ayrinti]
"""
import sys, re, subprocess, collections
from concurrent.futures import ThreadPoolExecutor

BEYIN, KUME = sys.argv[1], sys.argv[2]
GENEL = "--genel" in sys.argv
AYRINTI = "--ayrinti" in sys.argv

def ates(mesaj):
    r = subprocess.run([BEYIN, "ates", mesaj], capture_output=True, text=True, timeout=60)
    cikti = r.stdout
    basilan = re.findall(r"^─── ([a-z0-9-]+)", cikti, re.M)
    anilan = []
    m = re.search(r"gösterilmedi: ([^\n]*?)(?: —|$)", cikti, re.M)
    if m:
        anilan = [x.strip(" …") for x in m.group(1).split(",") if x.strip(" …")]
    return basilan, anilan, len(cikti)

satirlar = []
for s in open(KUME, encoding="utf-8"):
    if not s.strip() or s.startswith("#"):
        continue
    p = s.rstrip("\n").split("\t")
    if GENEL:
        satirlar.append((p[0], set(x.strip() for x in (p[2] if len(p) > 2 else "").split(",") if x.strip())))
    else:
        if len(p) < 3 or p[2].strip() == "SKIP":
            continue
        satirlar.append((p[0].strip(), p[1].strip(), p[2].strip()))

with ThreadPoolExecutor(3) as ex:
    sonuclar = list(ex.map(lambda r: ates(r[0] if GENEL else r[2]), satirlar))

if GENEL:
    hic, toplam_gurultu, bayt = 0, 0, 0
    for (mesaj, kabul), (bas, _, b) in zip(satirlar, sonuclar):
        gurultu = [x for x in bas if x not in kabul]
        toplam_gurultu += len(gurultu); bayt += b
        if gurultu:
            hic += 1
            if AYRINTI:
                print(f"   · {mesaj[:50]:<50} → {', '.join(gurultu)}")
    n = len(satirlar)
    print(f"GENEL küme: {n} mesaj · gürültü getiren mesaj {hic} (%{hic/n*100:.0f}) · "
          f"mesaj başı gürültü nöronu {toplam_gurultu/n:.2f} · ort. çıktı {bayt/n/1000:.1f} KB")
    sys.exit(0)

kova = collections.defaultdict(lambda: collections.Counter())
for (hedef, cesit, mesaj), (bas, anilan, b) in zip(satirlar, sonuclar):
    k = kova[cesit]
    k["n"] += 1
    k["gosterildi"] += hedef in bas
    k["anildi"] += (hedef in bas) or (hedef in anilan)
    k["basilan"] += len(bas)
    k["hic"] += (len(bas) == 0)
    k["bayt"] += b
    if AYRINTI and hedef not in bas:
        print(f"   ✗ {cesit:<7} {hedef:<40} \"{mesaj[:60]}\" → {bas[:4]}")
for cesit, k in sorted(kova.items()):
    n = k["n"]
    print(f"{cesit:<8} n={n:<4} hedef GÖSTERİLDİ %{k['gosterildi']/n*100:5.1f} · adı anıldı %{k['anildi']/n*100:5.1f} · "
          f"mesaj başı basılan {k['basilan']/n:.2f} · hiç getirmedi %{k['hic']/n*100:4.1f} · ort. çıktı {k['bayt']/n/1000:.1f} KB")
