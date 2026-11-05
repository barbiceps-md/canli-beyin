# -*- coding: utf-8 -*-
"""Canlı Beyin — veri üretici.

Bir Markdown not klasörünü (Obsidian tarzı, [[bağlantı]]lı) Canlı Beyin sayfasının okuduğu veri.js'e çevirir.
Yalnız Python standart kütüphanesi; kurulum gerekmez.

    python uret.py ornek/notlar              # ornek notlardan ./veri.js üretir
    python uret.py ~/notlarim -o veri.js     # kendi notların

Klasör yapısı (hepsi isteğe bağlı, ayrıntı README'de):
    beyin.json        ayarlar: alanlar, çekirdek sayfalar, güneş, başlangıç tarihi, gizlenecek kalıplar
    gorevler.json     açık işler   → yörüngede yapay uydu, "İşler" listesi
    bitenler.json     son bitenler → "İşler" listesinin altı
    arsiv/            buradaki notlar arşiv: "<ad>-gecmis.md" o sayfanın ayı, ötekiler kuyruklu yıldız
    *.md              her not bir nöron/gezegen; frontmatter'da  alan:  guncelleme:  dogum:  okunur
"""
import argparse
import datetime as dt
import hashlib
import io
import json
import math
import os
import random
import re
import sys

LINK = re.compile(r"\[\[([^\[\]]+?)\]\]")
TARIH = re.compile(r"\b(20\d\d)-(\d\d)-(\d\d)\b")
# sır gibi görünen kalıplar her zaman maskelenir (API anahtarı, jeton); beyin.json "gizle" ile ek kalıp verilebilir
SIR = re.compile(r"(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|gh[opsu]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}"
                 r"|AIza[0-9A-Za-z_-]{30,}|\b\d{8,10}:AA[0-9A-Za-z_-]{30,}|EAA[A-Za-z0-9]{30,})")


def oku(yol):
    with io.open(yol, encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")


def frontmatter(metin):
    """('anahtar: değer' sözlüğü, gövde)."""
    m = re.match(r"^---\n(.*?)\n---\n+", metin, re.S)
    if not m:
        return {}, metin
    fm = {}
    for satir in m.group(1).splitlines():
        k, _, v = satir.partition(":")
        if k.strip():
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm, metin[m.end():]


def kodsuz_satirlar(metin):
    """(satır_no, satır) — ``` kod blokları hariç."""
    icinde = False
    for i, s in enumerate(metin.splitlines(), 1):
        if s.lstrip().startswith("```"):
            icinde = not icinde
            continue
        if not icinde:
            yield i, s


def baglar(metin):
    out = []
    for _, s in kodsuz_satirlar(metin):
        for m in LINK.finditer(re.sub(r"`[^`]*`", "", s)):
            ad = m.group(1).split("|")[0].partition("#")[0].strip()
            if ad:
                out.append(ad[:-3] if ad.endswith(".md") else ad)
    return out


def basliklar(metin):
    out = []
    for i, s in kodsuz_satirlar(metin):
        m = re.match(r"^(#{1,6})\s+(.*?)\s*$", s)
        if m:
            out.append([i, len(m.group(1)), m.group(2)])
    return out


def tarihler(metin, alt, ust):
    out = []
    for m in TARIH.finditer(metin):
        try:
            t = dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            continue
        if alt <= t <= ust:
            out.append(t)
    return out


def tohum(anahtar):
    return random.Random(int(hashlib.md5(anahtar.encode("utf-8")).hexdigest()[:8], 16))


def yerlesim(dugumler, kenarlar):
    """Tohumlu 3B kuvvet yerleşimi: çekirdek ortada, canlı sayfalar kabukta, arşiv dış halkada; alanlar küme olur.
    Veri değişmedikçe konumlar aynı kalır."""
    alanlar = sorted({d["alan"] for d in dugumler if d["katman"] != "cekirdek"})
    yon = {}
    for i, a in enumerate(alanlar):
        y = 1 - (i + 0.5) / len(alanlar) * 2
        r = math.sqrt(max(0.0, 1 - y * y))
        th = math.pi * (3 - math.sqrt(5)) * i
        yon[a] = (math.cos(th) * r, y * 0.82, math.sin(th) * r)
    R = {"cekirdek": 0.3, "canli": 1.0, "arsiv": 1.62}
    # çekirdek sayfalar ortada eşit aralıklı bir halkada sabit durur
    cekirdek = [d["id"] for d in dugumler if d["katman"] == "cekirdek"]
    sabit = {}
    for i, c in enumerate(cekirdek):
        a = math.pi / 2 + i * 2 * math.pi / max(1, len(cekirdek))
        sabit[c] = [round(math.cos(a) * 0.3, 4), round(math.sin(a) * 0.3, 4), 0.05 * (i % 2 * 2 - 1)] if len(cekirdek) > 1 else [0.0, 0.0, 0.0]
    p = {}
    for d in dugumler:
        if d["id"] in sabit:
            p[d["id"]] = list(sabit[d["id"]])
            continue
        g = tohum(d["id"])
        taban = yon[d["alan"]]
        v = [taban[k] + g.uniform(-0.45, 0.45) for k in range(3)]
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        p[d["id"]] = [x / n * R[d["katman"]] for x in v]
    idler = [d["id"] for d in dugumler]
    katman = {d["id"]: d["katman"] for d in dugumler}
    alan = {d["id"]: d["alan"] for d in dugumler}
    for adim in range(320):
        soguma = 1.0 - adim / 400.0
        f = {i: [0.0, 0.0, 0.0] for i in idler}
        for ai in range(len(idler)):
            a = idler[ai]
            for b in idler[ai + 1:]:
                d = [p[a][k] - p[b][k] for k in range(3)]
                d2 = max(0.0025, sum(x * x for x in d))
                kuv = 0.0026 / d2
                for k in range(3):
                    f[a][k] += d[k] * kuv
                    f[b][k] -= d[k] * kuv
        for a, b, _ in kenarlar:
            d = [p[b][k] - p[a][k] for k in range(3)]
            uz = math.sqrt(sum(x * x for x in d)) or 1e-6
            kuv = (uz - 0.42) * 0.018 / uz
            for k in range(3):
                f[a][k] += d[k] * kuv
                f[b][k] -= d[k] * kuv
        for i in idler:
            if i in sabit:
                continue
            hedef = [x * R[katman[i]] for x in yon[alan[i]]]
            for k in range(3):
                f[i][k] += (hedef[k] - p[i][k]) * 0.012
                p[i][k] += max(-0.06, min(0.06, f[i][k])) * soguma
            r = math.sqrt(sum(x * x for x in p[i])) or 1e-6
            oran = 1 + (R[katman[i]] / r - 1) * 0.25
            p[i] = [x * oran for x in p[i]]
    return {i: [round(x, 4) for x in v] for i, v in p.items()}


def kisa_ad(baslik):
    return re.split(r" — | \(|: ", baslik, maxsplit=1)[0].strip()[:34]


def uret(kok, cikti):
    kok = os.path.abspath(kok)
    ayar = {}
    if os.path.exists(os.path.join(kok, "beyin.json")):
        ayar = json.loads(oku(os.path.join(kok, "beyin.json")))
    bugun = dt.date.fromisoformat(ayar["bugun"]) if ayar.get("bugun") else dt.date.today()
    alanlar = [[a["anahtar"], a["ad"]] + ([a.get("renk")] if a.get("renk") or a.get("gezegen") else []) +
               ([a["gezegen"]] if a.get("gezegen") else []) for a in ayar.get("alanlar", [])]
    alan_set = {a[0] for a in alanlar}
    varsayilan_alan = ayar.get("varsayilanAlan", "diger")
    cekirdek = set(ayar.get("cekirdek", []))
    gizle = [re.compile(k) for k in ayar.get("gizle", [])]

    def maskele(m):
        m = SIR.sub("••••••", m)
        for k in gizle:
            m = k.sub("••••••", m)
        return m

    yollar = []
    for ust, klasorler, dosyalar in os.walk(kok):
        klasorler[:] = sorted(k for k in klasorler if not k.startswith("."))
        yollar += [os.path.join(ust, f) for f in sorted(dosyalar) if f.endswith(".md") and f.lower() != "readme.md"]
    if not yollar:
        sys.exit("Not bulunamadı: %s içinde .md dosyası yok." % kok)

    ham = []
    for y in yollar:
        ad = os.path.basename(y)[:-3]
        metin = oku(y)
        fm, govde = frontmatter(metin)
        rel = os.path.relpath(y, kok).replace("\\", "/")
        katman = "cekirdek" if ad in cekirdek else "arsiv" if rel.startswith("arsiv/") else "canli"
        ham.append((ad, rel, fm, govde, katman, y))
    baslangic = dt.date.fromisoformat(ayar["baslangic"]) if ayar.get("baslangic") else None
    if baslangic is None:   # en eski tarih: metinlerdeki ya da dosya tarihlerindeki
        adaylar = [t for *_, g, _k, _y in ham for t in tarihler(g, dt.date(2000, 1, 1), bugun)]
        adaylar += [dt.date.fromtimestamp(os.path.getmtime(y)) for *_, y in ham]
        baslangic = min(adaylar)

    dugumler, var = [], {h[0] for h in ham}
    for ad, rel, fm, govde, katman, y in ham:
        h1 = next((t for _, sev, t in basliklar(govde) if sev == 1), ad)
        if katman == "arsiv" and ad.endswith("-gecmis") and ad[:-7] in var:
            ebeveyn = next(h for h in ham if h[0] == ad[:-7])
            alan = fm.get("alan") or ebeveyn[2].get("alan") or ("cekirdek" if ebeveyn[4] == "cekirdek" else varsayilan_alan)
        else:
            alan = fm.get("alan") or ("cekirdek" if katman == "cekirdek" else varsayilan_alan)
        if alan not in alan_set:
            alanlar.append([alan, alan.capitalize()])
            alan_set.add(alan)
        mtime = dt.datetime.fromtimestamp(os.path.getmtime(y))
        guncelleme = fm.get("guncelleme") or mtime.date().isoformat()
        if fm.get("dogum"):
            dogum = dt.date.fromisoformat(fm["dogum"])
        else:
            dogum = min(tarihler(govde, baslangic, bugun) + [dt.date.fromisoformat(guncelleme)])
        if katman == "cekirdek":
            dogum = baslangic
        dugumler.append({
            "id": ad, "yol": rel, "baslik": h1,
            "ad": kisa_ad(h1) + (" · geçmiş" if ad.endswith("-gecmis") else ""),
            "katman": katman, "alan": alan, "satir": len(govde.splitlines()), "karakter": len(govde),
            "guncelleme": guncelleme, "dogum": max(baslangic, dogum).isoformat(),
            "degisim": max(mtime, dt.datetime.fromisoformat(guncelleme + "T00:00")).strftime("%Y-%m-%d %H:%M"),
            "bolumler": [b for b in basliklar(govde) if b[1] <= 3],
            "metin": maskele(govde.rstrip() + "\n").replace("�", "U+FFFD"),
        })

    sayac = {}
    for ad, _rel, _fm, govde, *_ in ham:
        for hedef in baglar(govde):
            hedef = hedef.split("/")[-1]
            if hedef in var and hedef != ad:
                k = tuple(sorted((ad, hedef)))
                sayac[k] = sayac.get(k, 0) + 1
    kenarlar = [[a, b, n] for (a, b), n in sorted(sayac.items())]
    konum = yerlesim(dugumler, kenarlar)
    derece = {}
    for a, b, _ in kenarlar:
        derece[a] = derece.get(a, 0) + 1
        derece[b] = derece.get(b, 0) + 1
    for d in dugumler:
        d["konum"] = konum[d["id"]]
        d["derece"] = derece.get(d["id"], 0)

    gorevler = []
    yol = os.path.join(kok, "gorevler.json")
    for i, g in enumerate(json.loads(oku(yol)) if os.path.exists(yol) else [], 1):
        son = g.get("son", "")
        gorevler.append({"no": str(g.get("no", i)), "baslik": g["baslik"], "durum": g.get("durum", "bende"),
                         "ozet": maskele(g.get("ozet", "")), "son": son,
                         "yas": (bugun - dt.date.fromisoformat(son)).days if son else None,
                         "oncelik": bool(g.get("oncelik")), "sayfa": g.get("sayfa", "")})
    yol = os.path.join(kok, "bitenler.json")
    bitenler = [{"metin": maskele(b["metin"]), "sayfa": b.get("sayfa", "")}
                for b in (json.loads(oku(yol)) if os.path.exists(yol) else [])]

    ist = {"noron": len(dugumler), "sinaps": len(kenarlar), "karakter": sum(d["karakter"] for d in dugumler),
           "canli_karakter": sum(d["karakter"] for d in dugumler if d["katman"] != "arsiv"),
           "gun": (bugun - baslangic).days + 1, "oturum": ayar.get("oturum"), "baslangic": baslangic.isoformat(),
           "son_degisim": max(d["degisim"] for d in dugumler),
           "uretim": dt.datetime.now().strftime("%Y-%m-%d %H:%M"), "bugun": bugun.isoformat()}
    veri = {"surum": 1, "ayar": {k: ayar[k] for k in ("gunes", "nabiz", "isListesi") if ayar.get(k)},
            "istatistik": ist, "alanlar": alanlar, "dugumler": dugumler, "kenarlar": kenarlar,
            "gorevler": gorevler, "bitenler": bitenler}
    if ayar.get("durumlar"):
        veri["durumlar"] = ayar["durumlar"]
    with io.open(cikti, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("window.BEYIN = ")
        json.dump(veri, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    return ist


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description="Markdown not klasöründen Canlı Beyin verisi (veri.js) üretir.")
    ap.add_argument("klasor", help="notların olduğu klasör (ör. ornek/notlar)")
    ap.add_argument("-o", "--cikti", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "veri.js"),
                    help="çıktı dosyası (varsayılan: index.html'in yanındaki veri.js)")
    a = ap.parse_args()
    i = uret(a.klasor, a.cikti)
    print("OK %s — %d nöron · %d sinaps · %s karakter · %d gün" % (
        a.cikti, i["noron"], i["sinaps"], "{:,}".format(i["karakter"]).replace(",", "."), i["gun"]))
    print("   index.html'i tarayıcıda aç.")


if __name__ == "__main__":
    main()
