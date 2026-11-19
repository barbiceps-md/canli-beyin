# -*- coding: utf-8 -*-
"""Canlı Beyin — veri üretici.

Bir not klasörünü Canlı Beyin sayfasının okuduğu veri.js'e çevirir. Yalnız Python standart kütüphanesi.
İki tür klasör tanır (kendiliğinden):

  kasa   Beyin v4 hafıza kasası (kural/ ders/ wiki/ arsiv/ gunluk/ is/ konu.tsv NORON.md). Nöronlar (kural/ders/olgu
         kartları) kaynak sayfalarının çevresinde küçük kürecikler / yörüngede kuşak olur; açık işler is/acik.md'den.
  notlar Düz Markdown klasörü (Obsidian tarzı [[bağlantı]]). Her .md bir nöron / gezegen.

    python canli/uret.py ornek/kasa                       # örnek kasadan canli/veri.js
    python canli/uret.py ornek/notlar -o /tmp/veri.js     # düz not klasörü
    python canli/uret.py ~/beyin --sayfa ~/canli-ozel     # sayfanın tamamını (html+css+js+veri) ayrı klasöre

Ayar dosyası (isteğe bağlı): kasada canli.json, not klasöründe beyin.json — alanlar ve anlamları README'de.
⚠️ veri.js notların TAM METNİNİ içerir. Kendi notlarınla ürettiğini herkese açık bir yere koyma.
"""
import argparse
import datetime as dt
import glob
import hashlib
import io
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys

BURASI = os.path.dirname(os.path.abspath(__file__))
SAYFA_DOSYALARI = ("index.html", "beyin.css", "beyin.js")
LINK = re.compile(r"\[\[([^\[\]]+?)\]\]")
AYLAR = {"oca": 1, "şub": 2, "mar": 3, "nis": 4, "may": 5, "haz": 6, "tem": 7, "ağu": 8, "eyl": 9, "eki": 10,
         "kas": 11, "ara": 12}
TR = str.maketrans("ıİşŞğĞüÜöÖçÇâÂîÎûÛ", "iissgguuooccaaiiuu")
RENK = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
GEZEGENLER = {"saturn", "mars", "jupiter", "uranus", "dunya", "neptun", "pluton", "venus"}
UYARILAR = []

# Sır gibi görünen kalıplar HER ZAMAN maskelenir; ayar dosyasındaki "gizle" düzenli ifadeleri ve --sirlar listesi ek olarak.
SIR = re.compile(r"(sk-ant-[A-Za-z0-9_-]{8,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
                 r"|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|\b\d{8,10}:AA[0-9A-Za-z_-]{30,}|EAA[A-Za-z0-9]{30,}"
                 r"|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----)")
CIFT = re.compile(r"(`[^`\s]+@[^`\s]+`\s*/\s*`)([^`]+)(`)")                       # `e-posta` / `şifre`
ATAMA = re.compile(r"""((?:PASSWORD|PASSWD|PAROLA|SIFRE|ŞİFRE|SECRET|TOKEN|API_KEY|APIKEY)\w*\s*[:=]\s*\\?["'])([^"'\\\s]{4,})""", re.I)
BAGLANTI_PAROLA = re.compile(r"(\b[a-z][a-z0-9+.-]*://[^\s:/@]+:)([^\s@/]{3,})(@)", re.I)   # postgres://ad:PAROLA@sunucu
# Sert kural: hafıza çekirdeğinin (hafiza/bin/beyin) kullandığı sözlerle aynı + ⛔
SERT = re.compile(r"(⛔|asla|yasak|önce onay|onay (şart|gerek|iste|al)|kesinlikle|geri dönüşsüz)", re.I)


def katla(s):
    return s.translate(TR).lower()


def uyar(s):
    UYARILAR.append(s)


def oku(yol):
    """UTF-8 (BOM'lu da) okur; değilse Windows Türkçe (cp1254) dener ve uyarır. Satır sonu \\n'e indirilir."""
    try:
        with open(yol, "rb") as f:
            ham = f.read()
    except OSError:
        return ""
    if ham.startswith(b"\xef\xbb\xbf"):
        ham = ham[3:]
    try:
        metin = ham.decode("utf-8")
    except UnicodeDecodeError:
        metin = ham.decode("cp1254", errors="replace")
        uyar("%s UTF-8 değil — Windows Türkçe (cp1254) sayıldı; dosyayı UTF-8 kaydetmen önerilir" % os.path.basename(yol))
    return metin.replace("\r\n", "\n").replace("\r", "\n")


def frontmatter(metin):
    """('anahtar: değer' sözlüğü, gövde). Kapanış --- kendi satırında aranır."""
    m = re.match(r"^---[ \t]*\n(.*?)\n---[ \t]*(?:\n|$)", metin, re.S)
    if not m:
        return {}, metin
    fm = {}
    for satir in m.group(1).splitlines():
        k, ayrac, v = satir.partition(":")
        if ayrac and k.strip() and not k.startswith((" ", "\t", "-", "#")):
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm, metin[m.end():].lstrip("\n")


def kodsuz_satirlar(metin):
    """(satır_no, satır) — ``` / ~~~ kod blokları hariç."""
    icinde = None
    for i, s in enumerate(metin.splitlines(), 1):
        t = s.lstrip()
        if t.startswith("```") or t.startswith("~~~"):
            isaret = t[:3]
            icinde = None if icinde == isaret else (icinde or isaret)
            continue
        if not icinde:
            yield i, s


def baglar(metin):
    out = []
    for _, s in kodsuz_satirlar(metin):
        for m in LINK.finditer(re.sub(r"`[^`]*`", "", s)):
            ad = m.group(1).split("|")[0].partition("#")[0].strip()
            if ad:
                ad = ad[:-3] if ad.lower().endswith(".md") else ad
                out.append(ad.replace("\\", "/").split("/")[-1])
    return out


def basliklar(metin):
    out = []
    for i, s in kodsuz_satirlar(metin):
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*\s*$", s)
        if m and m.group(2):
            out.append([i, len(m.group(1)), m.group(2)])
    return out


def tarih(s):
    """'YYYY-AA-GG' → date; bozuksa None (takvimde olmayan tarih çökertmez)."""
    try:
        return dt.date.fromisoformat((s or "").strip()[:10])
    except ValueError:
        return None


def metin_tarihleri(metin, alt, ust):
    """Metinde geçen tarihler: 2026-11-04 · 04.11.2026 · '4 Kas' (yıl: üst sınırın yılı, ileriye düşerse bir önceki)."""
    out = []
    for m in re.finditer(r"\b(20\d\d)-(\d\d)-(\d\d)\b", metin):
        out.append(tarih(m.group(0)))
    for m in re.finditer(r"\b(\d{1,2})\.(\d{1,2})\.(20\d\d)\b", metin):
        try:
            out.append(dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))))
        except ValueError:
            pass
    for m in re.finditer(r"\b(\d{1,2}) (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)\w*", metin):
        try:
            t = dt.date(ust.year, AYLAR[m.group(2).lower()], int(m.group(1)))
            out.append(t if t <= ust else t.replace(year=ust.year - 1))
        except (ValueError, KeyError):
            pass
    return [t for t in out if t and alt <= t <= ust]


def tohum(anahtar):
    return random.Random(int(hashlib.md5(anahtar.encode("utf-8")).hexdigest()[:8], 16))


def kisa_ad(baslik, yedek, n=34):
    ad = re.split(r" — | \(|: ", (baslik or "").replace("**", "").replace("`", ""), maxsplit=1)[0].strip()
    ad = ad or yedek
    if len(ad) <= n:
        return ad
    kes = ad[:n - 1].rsplit(" ", 1)[0] if " " in ad[:n - 1] else ad[:n - 1]   # kelime ortasında kesme
    return kes.rstrip(" ,;·-") + "…"


class Maske:
    def __init__(self, ek_desenler=(), sirlar=()):
        self.ek = []
        for k in ek_desenler:
            try:
                self.ek.append(re.compile(k))
            except re.error as e:
                uyar("gizle kalıbı geçersiz, atlandı: %r (%s)" % (k, e))
        self.sirlar = sorted({s for s in sirlar if len(s) >= 4}, key=len, reverse=True)

    def __call__(self, m):
        m = SIR.sub("••••••", m)
        m = CIFT.sub(lambda x: x.group(1) + "••••••" + x.group(3), m)
        m = ATAMA.sub(lambda x: x.group(1) + "••••••", m)
        m = BAGLANTI_PAROLA.sub(lambda x: x.group(1) + "••••••" + x.group(3), m)
        for k in self.ek:
            m = k.sub("••••••", m)
        for s in self.sirlar:
            m = m.replace(s, "••••••")
        return m


# ---------------------------------------------------------------- yerleşim ----
def yerlesim(dugumler, kenarlar):
    """Tohumlu 3B kuvvet yerleşimi: çekirdek ortada, canlı sayfalar kabukta, arşiv dış halkada; alanlar küme olur.
    Veri değişmedikçe konumlar aynı kalır. Nöronlar (katman 'noron') burada değil, noron_yerlesim'de.
    Büyük klasörde itme yalnız komşu ızgara hücrelerinden hesaplanır (O(n²) yerine ~O(n)): 2.000 not saniyeler sürer."""
    sayfa = [d for d in dugumler if d["katman"] != "noron"]
    if not sayfa:
        return {}
    alanlar = sorted({d["alan"] for d in sayfa if d["katman"] != "cekirdek"})
    yon = {}
    for i, a in enumerate(alanlar):
        y = 1 - (i + 0.5) / len(alanlar) * 2
        r = math.sqrt(max(0.0, 1 - y * y))
        th = math.pi * (3 - math.sqrt(5)) * i
        yon[a] = (math.cos(th) * r, y * 0.82, math.sin(th) * r)
    R = {"cekirdek": 0.3, "canli": 1.0, "arsiv": 1.62}
    cekirdek = [d["id"] for d in sayfa if d["katman"] == "cekirdek"]
    sabit = {}
    for i, c in enumerate(cekirdek):   # çekirdek sayfalar ortada eşit aralıklı bir halkada sabit
        a = math.pi / 2 + i * 2 * math.pi / max(1, len(cekirdek))
        sabit[c] = ([round(math.cos(a) * 0.3, 4), round(math.sin(a) * 0.3, 4), 0.05 * (i % 2 * 2 - 1)]
                    if len(cekirdek) > 1 else [0.0, 0.0, 0.0])
    p = {}
    for d in sayfa:
        if d["id"] in sabit:
            p[d["id"]] = list(sabit[d["id"]])
            continue
        g = tohum(d["id"])
        taban = yon.get(d["alan"], (0.0, 0.0, 0.0))
        v = [taban[k] + g.uniform(-0.45, 0.45) for k in range(3)]
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        p[d["id"]] = [x / n * R[d["katman"]] for x in v]
    idler = [d["id"] for d in sayfa]
    katman = {d["id"]: d["katman"] for d in sayfa}
    alan = {d["id"]: d["alan"] for d in sayfa}
    sk = [(a, b) for a, b, _ in kenarlar if a in p and b in p]
    buyuk = len(idler) > 220
    # büyük klasör: alan yönü + tohumlu dağılım zaten kümeyi kurar; kuvvet yalnız yakın komşuyu iter (küçük hücre, az adım)
    adimlar = 320 if not buyuk else 45
    HUCRE = 0.14
    for adim in range(adimlar):
        soguma = 1.0 - adim / (adimlar * 1.25)
        f = {i: [0.0, 0.0, 0.0] for i in idler}
        if not buyuk:
            ciftler = ((idler[ai], b) for ai in range(len(idler)) for b in idler[ai + 1:])
        else:
            izgara = {}
            for i in idler:
                izgara.setdefault(tuple(int(math.floor(x / HUCRE)) for x in p[i]), []).append(i)
            def _ciftler():
                for (hx, hy, hz), uyeler in izgara.items():
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            for dz in (-1, 0, 1):
                                diger = izgara.get((hx + dx, hy + dy, hz + dz))
                                if not diger:
                                    continue
                                for a in uyeler:
                                    for b in diger:
                                        if a < b:
                                            yield a, b
            ciftler = _ciftler()
        for a, b in ciftler:
            pa, pb = p[a], p[b]
            d0, d1, d2 = pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]
            kuv = 0.0026 / max(0.0025, d0 * d0 + d1 * d1 + d2 * d2)
            fa, fb = f[a], f[b]
            fa[0] += d0 * kuv; fa[1] += d1 * kuv; fa[2] += d2 * kuv
            fb[0] -= d0 * kuv; fb[1] -= d1 * kuv; fb[2] -= d2 * kuv
        for a, b in sk:
            d = [p[b][k] - p[a][k] for k in range(3)]
            uz = math.sqrt(sum(x * x for x in d)) or 1e-6
            kuv = (uz - 0.42) * 0.018 / uz
            for k in range(3):
                f[a][k] += d[k] * kuv
                f[b][k] -= d[k] * kuv
        for i in idler:
            if i in sabit:
                continue
            if katman[i] != "cekirdek":
                hedef = [x * R[katman[i]] for x in yon[alan[i]]]
                for k in range(3):
                    f[i][k] += (hedef[k] - p[i][k]) * 0.012
            for k in range(3):
                p[i][k] += max(-0.06, min(0.06, f[i][k])) * soguma
            r = math.sqrt(sum(x * x for x in p[i])) or 1e-6
            hr = R[katman[i]]
            oran = 1 + (hr / r - 1) * (0.25 if katman[i] != "cekirdek" else 0.1)
            if katman[i] == "cekirdek" and r < hr:
                oran = 1.0
            p[i] = [x * oran for x in p[i]]
    return {i: [round(x, 4) for x in v] for i, v in p.items()}


def noron_yerlesim(dugumler, p, yedek):
    """Nöronlar kaynak sayfasının çevresinde küçük bir küre kabuğunda (Fibonacci dağılımı), merkezden biraz dışa itik."""
    gruplar = {}
    for d in dugumler:
        if d["katman"] == "noron":
            gruplar.setdefault(d.get("kaynak") if d.get("kaynak") in p else yedek, []).append(d["id"])
    for ebeveyn, uyeler in gruplar.items():
        c = p.get(ebeveyn, [0.0, 0.0, 0.0])
        n = len(uyeler)
        cr = math.sqrt(sum(x * x for x in c)) or 1.0
        disa = [x / cr for x in c] if cr > 0.05 else [0, 1, 0]
        for j, nid in enumerate(sorted(uyeler)):
            y = 1 - (j + 0.5) / n * 2
            r = math.sqrt(max(0.0, 1 - y * y))
            th = math.pi * (3 - math.sqrt(5)) * j
            g = tohum(nid)
            yar = 0.10 + 0.05 * g.random() + 0.004 * math.sqrt(n)
            v = [math.cos(th) * r, y, math.sin(th) * r]
            p[nid] = [round(c[k] + v[k] * yar + disa[k] * 0.06, 4) for k in range(3)]
    return p


# ------------------------------------------------------------------ ortak ----
def alan_listesi(ayar):
    """beyin.json / canli.json 'alanlar' → [[anahtar, ad, renk?, gezegen?]]; geçersiz renk/gezegen atlanır (uyarıyla)."""
    out = []
    for a in ayar.get("alanlar", []):
        if not isinstance(a, dict) or not a.get("anahtar"):
            uyar("alanlar: anahtarı olmayan girdi atlandı: %r" % (a,))
            continue
        renk, gez = a.get("renk"), a.get("gezegen")
        if renk and not RENK.match(str(renk)):
            uyar("alan %s: renk %r geçersiz (#RGB ya da #RRGGBB) — varsayılan palet" % (a["anahtar"], renk))
            renk = None
        if gez and gez not in GEZEGENLER:
            uyar("alan %s: gezegen %r bilinmiyor (%s)" % (a["anahtar"], gez, ", ".join(sorted(GEZEGENLER))))
            gez = None
        out.append([str(a["anahtar"]), str(a.get("ad") or a["anahtar"])] + ([renk or ""] if renk or gez else []) + ([gez] if gez else []))
    return out


def kenar_say(dugumler, cift_listesi):
    var = {d["id"] for d in dugumler}
    sayac = {}
    for a, b in cift_listesi:
        if a != b and a in var and b in var:
            k = tuple(sorted((a, b)))
            sayac[k] = sayac.get(k, 0) + 1
    return [[a, b, n] for (a, b), n in sorted(sayac.items())]


def tamamla(dugumler, kenarlar, yedek_merkez):
    p = yerlesim(dugumler, kenarlar)
    p = noron_yerlesim(dugumler, p, yedek_merkez)
    derece = {}
    for a, b, _ in kenarlar:
        derece[a] = derece.get(a, 0) + 1
        derece[b] = derece.get(b, 0) + 1
    for d in dugumler:
        d["konum"] = p.get(d["id"], [0.0, 0.0, 0.0])
        d["derece"] = derece.get(d["id"], 0)


def benzersiz_id(ad, rel, kullanilan):
    """Aynı adlı iki not (farklı klasörde) birbirini ezmesin: ikincisi yoluyla adlanır."""
    if ad not in kullanilan:
        return ad
    yeni = rel[:-3] if rel.lower().endswith(".md") else rel
    uyar("aynı adlı iki not: %s — ikincisinin kimliği '%s' oldu ([[%s]] ilkine gider)" % (ad, yeni, ad))
    return yeni


def dugum(id_, yol, govde, katman, alan, maske, guncelleme, dogum, degisim, h1=None, ad=None, **ek):
    h1 = h1 or next((t for _, sev, t in basliklar(govde) if sev == 1), id_)
    d = {"id": id_, "yol": yol, "baslik": maske(h1), "ad": maske(ad or kisa_ad(h1, id_)), "katman": katman, "alan": alan,
         "satir": len(govde.splitlines()), "karakter": len(govde), "guncelleme": guncelleme.isoformat(),
         "dogum": dogum.isoformat(), "degisim": degisim, "bolumler": [[s, v, maske(t)] for s, v, t in basliklar(govde) if v <= 3],
         "metin": maske(govde.rstrip() + "\n")}
    d.update(ek)
    return d


def mtime(yol):
    try:
        return dt.datetime.fromtimestamp(os.path.getmtime(yol))
    except (OSError, ValueError, OverflowError):
        return dt.datetime(2000, 1, 1)


def ayar_oku(yol):
    if not os.path.exists(yol):
        return {}
    try:
        a = json.loads(oku(yol))
        if not isinstance(a, dict):
            raise ValueError("nesne değil")
        return a
    except ValueError as e:
        sys.exit("Ayar dosyası okunamadı: %s (%s)" % (yol, e))


def json_oku(yol, ne):
    if not os.path.exists(yol):
        return []
    try:
        v = json.loads(oku(yol))
        return v if isinstance(v, list) else []
    except ValueError as e:
        uyar("%s okunamadı (%s) — boş sayıldı" % (ne, e))
        return []


# ------------------------------------------------------------ düz notlar ----
def notlar_modu(kok, ayar, maske, bugun):
    alanlar = alan_listesi(ayar)
    alan_set = {a[0] for a in alanlar}
    varsayilan_alan = ayar.get("varsayilanAlan", "diger")
    cekirdek = set(ayar.get("cekirdek", []))
    yollar = []
    for ust, klasorler, dosyalar in os.walk(kok):
        klasorler[:] = sorted(k for k in klasorler if not k.startswith(".") and k not in ("node_modules", "__pycache__"))
        yollar += [os.path.join(ust, f) for f in sorted(dosyalar) if f.lower().endswith(".md") and f.lower() != "readme.md"]
    if not yollar:
        sys.exit("Not bulunamadı: %s içinde .md dosyası yok." % kok)
    ham, kullanilan = [], set()
    for y in yollar:
        rel = os.path.relpath(y, kok).replace("\\", "/")
        ad = benzersiz_id(os.path.basename(y)[:-3], rel, kullanilan)
        kullanilan.add(ad)
        fm, govde = frontmatter(oku(y))
        katman = "cekirdek" if ad in cekirdek else "arsiv" if rel.startswith("arsiv/") else "canli"
        ham.append((ad, rel, fm, govde, katman, y))
    baslangic = tarih(ayar.get("baslangic"))
    if baslangic is None:   # en eski: ön bilgideki tarihler ve dosya tarihleri (metindeki tarihler bir tarihi olaya ait olabilir)
        adaylar = [t for h in ham for t in (tarih(h[2].get("dogum")), tarih(h[2].get("guncelleme"))) if t]
        adaylar += [mtime(h[5]).date() for h in ham]
        baslangic = min(t for t in adaylar if t <= bugun) if any(t <= bugun for t in adaylar) else bugun
    ad_haritasi = {h[0]: h for h in ham}
    kucuk = {}
    for h in ham:
        kucuk.setdefault(h[0].lower(), h[0])
    dugumler = []
    for ad, rel, fm, govde, katman, y in ham:
        h1 = next((t for _, sev, t in basliklar(govde) if sev == 1), ad)
        ebeveyn = ad_haritasi.get(ad[:-7]) if katman == "arsiv" and ad.endswith("-gecmis") else None
        if ebeveyn:
            alan = fm.get("alan") or ebeveyn[2].get("alan") or ("cekirdek" if ebeveyn[4] == "cekirdek" else varsayilan_alan)
        else:
            alan = fm.get("alan") or ("cekirdek" if katman == "cekirdek" else varsayilan_alan)
        if alan not in alan_set:
            alanlar.append([alan, alan[:1].upper() + alan[1:]])
            alan_set.add(alan)
        mt = mtime(y)
        guncelleme = tarih(fm.get("guncelleme")) or mt.date()
        if fm.get("guncelleme") and not tarih(fm.get("guncelleme")):
            uyar("%s: guncelleme %r geçersiz tarih — dosya tarihi kullanıldı" % (rel, fm["guncelleme"]))
        dogum = tarih(fm.get("dogum")) or min(metin_tarihleri(govde, baslangic, bugun) + [guncelleme])
        if katman == "cekirdek":
            dogum = baslangic
        degisim = max(mt, dt.datetime.combine(guncelleme, dt.time())).strftime("%Y-%m-%d %H:%M")
        dugumler.append(dugum(ad, rel, govde, katman, alan, maske, guncelleme, max(baslangic, min(dogum, bugun)), degisim,
                              h1=h1, ad=kisa_ad(h1, ad) + (" · geçmiş" if ad.endswith("-gecmis") else "")))
    ciftler = []
    for ad, _rel, _fm, govde, *_ in ham:
        for hedef in baglar(govde):
            ciftler.append((ad, hedef if hedef in ad_haritasi else kucuk.get(hedef.lower(), hedef)))
    kenarlar = kenar_say(dugumler, ciftler)
    tamamla(dugumler, kenarlar, next(iter(cekirdek), None))
    gorevler = []
    for i, g in enumerate(json_oku(os.path.join(kok, "gorevler.json"), "gorevler.json"), 1):
        if not isinstance(g, dict) or not g.get("baslik"):
            continue
        son = tarih(g.get("son"))
        gorevler.append({"no": str(g.get("no", i)), "baslik": maske(str(g["baslik"])), "durum": g.get("durum", "bende"),
                         "ozet": maske(str(g.get("ozet", ""))), "son": son.isoformat() if son else "",
                         "yas": (bugun - son).days if son else None, "oncelik": bool(g.get("oncelik")),
                         "sayfa": str(g.get("sayfa", ""))})
    bitenler = [{"metin": maske(str(b.get("metin", ""))), "sayfa": str(b.get("sayfa", ""))}
                for b in json_oku(os.path.join(kok, "bitenler.json"), "bitenler.json") if isinstance(b, dict)]
    veri = {"tur": "notlar", "ayar": {k: ayar[k] for k in ("gunes", "nabiz", "isListesi") if ayar.get(k)},
            "alanlar": alanlar, "dugumler": dugumler, "kenarlar": kenarlar, "gorevler": gorevler, "bitenler": bitenler,
            "katmanAd": {"canli": "not · bağlantılarıyla", "cekirdek": "çekirdek · merkezdeki not"}}
    if ayar.get("durumlar"):
        veri["durumlar"] = ayar["durumlar"]
    return veri, baslangic


# ----------------------------------------------------------- Beyin v4 kasası ----
def kasa_mi(kok):
    return os.path.isdir(os.path.join(kok, "kural")) or os.path.isdir(os.path.join(kok, "ders")) \
        or os.path.exists(os.path.join(kok, "NORON.md"))


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", katla(s)).strip("-") or "alan"


def kasa_alanlari(kok, ayar):
    """wiki/index.md'deki '## Grup' başlıkları alan olur; altındaki [[sayfa]]lar o alana girer. canli.json 'alanlar' ile
    ad/renk/gezegen ezilir (anahtar = başlığın sadeleşmiş hâli, ör. '## Ev ve bahçe' → ev-ve-bahce)."""
    harita, sira, grup = {}, [], None
    for s in oku(os.path.join(kok, "wiki", "index.md")).splitlines():
        if s.startswith("## "):
            ad = s[3:].strip()
            grup = slug(ad)
            if grup not in [a for a, _ in sira]:
                sira.append((grup, ad))
        elif grup:
            for hedef in baglar(s):
                harita.setdefault(hedef, grup)
    ezen = {a[0]: a for a in alan_listesi(ayar)}
    alanlar = [["cekirdek", "Çekirdek"]] + [ezen.get(k, [k, ad]) for k, ad in sira if k != "cekirdek"]
    alanlar += [a for k, a in ezen.items() if k not in {x[0] for x in alanlar}]
    if "cekirdek" in ezen:
        alanlar[0] = ezen["cekirdek"]
    return harita, alanlar


def giris_metni(kok):
    """Oturum başında hafızanın yüklediğinin aynısı: `beyin giris` (ölçülen durum + son 72 saat + açık işler)."""
    beyin = os.path.join(BURASI, "..", "hafiza", "bin", "beyin")
    ortam = dict(os.environ, PYTHONUTF8="1", BEYIN_ANLAM="0", BEYIN_KASA=kok)
    try:
        r = subprocess.run([sys.executable, beyin, "giris"], capture_output=True, text=True, encoding="utf-8",
                           errors="replace", env=ortam, timeout=60)
        return r.stdout
    except Exception as e:   # sayfa yine de üretilsin
        return "(beyin giris çalışmadı: %s)" % e


def gorevler_kasa(kok, maske, bugun):
    """is/acik.md (+ is/kucuk.md) tablo satırları; ayrıntı is/ayrinti.md '### <no>' bölümünden:
    **başlık** satırı · *durum: … · son: AAAA-AA-GG · sayfa: [[x]] · öncelik: yüksek* satırı · > özet satırı."""
    satirlar = oku(os.path.join(kok, "is", "acik.md")) + "\n" + oku(os.path.join(kok, "is", "kucuk.md"))
    ayr = oku(os.path.join(kok, "is", "ayrinti.md"))
    out = []
    for l in satirlar.splitlines():
        h = [x.strip() for x in l.strip().strip("|").split("|")]
        if not l.startswith("|") or len(h) < 2 or not re.match(r"^\d+\w*$", h[0]):
            continue
        no = h[0]
        m = re.search(r"^### %s\s*$(.*?)(?=^### |^## |\Z)" % re.escape(no), ayr, re.M | re.S)
        bolum = m.group(1) if m else ""
        bas = (re.search(r"^\*\*(.+?)\*\*\s*$", bolum, re.M) or [None, h[1]])[1]
        meta = (re.search(r"^\*([^*\n]*(?:durum|son|sayfa|öncelik):[^*\n]*)\*\s*$", bolum, re.M) or [None, ""])[1]
        d = {k: v.strip() for k, v in re.findall(r"(durum|son|sayfa|öncelik): ([^·]+)", meta)}
        kim = katla(h[2]) if len(h) > 2 else ""
        dur = katla(d.get("durum") or (h[3] if len(h) > 3 else ""))
        if "aski" in dur:
            durum = "askida"
        elif d.get("durum") in ("bende", "sende"):
            durum = d["durum"]
        elif "dis" in dur or "dis" in kim:
            durum = "dista"
        elif "claude" in kim or kim in ("ben", "bende", "biz"):
            durum = "bende"
        else:
            durum = "sende"
        son = tarih(d.get("son"))
        if not son and len(h) > 4:   # tablodaki tarih: 05.09 ya da 05.09.2026 ya da 2026-09-05
            son = tarih(h[4]) or next(iter(metin_tarihleri(h[4], dt.date(2000, 1, 1), bugun)), None)
            if not son:
                x = re.match(r"^(\d{1,2})\.(\d{1,2})$", h[4])
                if x:
                    try:
                        son = dt.date(bugun.year, int(x.group(2)), int(x.group(1)))
                        son = son if son <= bugun else son.replace(year=bugun.year - 1)
                    except ValueError:
                        son = None
        sayfa = (baglar(d.get("sayfa", "")) or baglar(l) or [re.sub(r"[\[\]]", "", d.get("sayfa", "")).strip()])[0]
        ozet = (re.search(r"^> (.+)$", bolum, re.M) or [None, ""])[1]
        out.append({"no": no, "baslik": maske(bas), "durum": durum, "ozet": maske(ozet),
                    "son": son.isoformat() if son else "", "yas": (bugun - son).days if son else None,
                    "oncelik": d.get("öncelik", "").startswith("yüksek") or "öncelik" in katla(l) or "⭐" in l,
                    "sayfa": sayfa})
    return out


def bitenler_kasa(kok, maske, adet=10):
    """Son günlük notları (en yeni üstte)."""
    out = []
    for p in sorted(glob.glob(os.path.join(kok, "gunluk", "20??-??-??.md")), reverse=True):
        for l in reversed(oku(p).splitlines()):
            if not l.startswith("- ["):
                continue
            metin = re.sub(r"^- \[[^\]]*\]\s*", "", l)
            linkler = baglar(metin)
            metin = re.sub(r"\s*(→\s*)?(\[\[[^\]]+\]\][\s·,]*)+\s*$", "", metin).replace("**", "").replace("`", "")
            g = os.path.basename(p)
            out.append({"metin": maske(g[8:10] + "." + g[5:7] + " · " + metin), "sayfa": linkler[0] if linkler else ""})
            if len(out) >= adet:
                return out
    return out


def kasa_modu(kok, ayar, maske, bugun, kurallar=None, giris=False):
    alan_h, alanlar = kasa_alanlari(kok, ayar)
    alan_set = {a[0] for a in alanlar}
    D = []
    bilinen = []      # ön bilgi tarihleri + dosya tarihleri → başlangıç

    def ekle(id_, yol, metin, katman, alan, dosya=None, **ek):
        fm, govde = frontmatter(metin)
        mt = mtime(dosya) if dosya else dt.datetime.combine(bugun, dt.time())
        gn = tarih(fm.get("guncelleme")) or mt.date()
        bilinen.append(min(gn, mt.date()))
        D.append((id_, yol, fm, govde, katman, alan, gn, mt, ek))

    if kurallar:
        ekle("kurallar", "CLAUDE.md", oku(kurallar), "cekirdek", "cekirdek", kurallar, ad="Kurallar (CLAUDE.md)")
    if giris:
        ekle("hot", "beyin giris (oturum başı)", "# Oturum girişi — ölçülen durum, son 72 saat, açık işler\n\n```\n" +
             giris_metni(kok).rstrip() + "\n```\n", "cekirdek", "cekirdek", ad="Oturum girişi")
    if os.path.exists(os.path.join(kok, "NORON.md")):
        ekle("sozlesme", "NORON.md", oku(os.path.join(kok, "NORON.md")), "cekirdek", "cekirdek",
             os.path.join(kok, "NORON.md"), ad="Nöron sözleşmesi")
    konu = oku(os.path.join(kok, "konu.tsv"))
    konu_md = "\n".join("- `%s` — %s · tetik: %s" % (x[1], x[2] if len(x) > 2 else "", x[0])
                        for x in (l.split("\t") for l in konu.splitlines() if l.strip() and not l.startswith("#")) if len(x) > 1)
    idx = os.path.join(kok, "wiki", "index.md")
    ekle("index", "wiki/index.md + konu.tsv", (oku(idx) or "# Konu dizini\n") +
         ("\n\n## Konu dizini (konu.tsv)\n\n" + konu_md + "\n" if konu_md else ""), "cekirdek", "cekirdek",
         idx if os.path.exists(idx) else None, ad="Konu dizini")
    for p in sorted(glob.glob(os.path.join(kok, "wiki", "*.md"))):
        ad = os.path.basename(p)[:-3]
        if ad != "index":
            fm, _ = frontmatter(oku(p))
            ekle(ad, "wiki/" + ad + ".md", oku(p), "canli", alan_h.get(ad) or fm.get("alan") or "diger", p)
    for p in sorted(glob.glob(os.path.join(kok, "arsiv", "*.md"))):
        ad = os.path.basename(p)[:-3]
        taban = ad[:-7] if ad.endswith("-gecmis") else ad
        _, gv = frontmatter(oku(p))
        h1 = next((t for _, sev, t in basliklar(gv) if sev == 1), ad)
        ekle(ad, "arsiv/" + ad + ".md", oku(p), "arsiv", alan_h.get(taban, "cekirdek"), p,
             ad=kisa_ad(h1, ad) + (" · geçmiş" if ad.endswith("-gecmis") else ""))
    gunler = sorted(glob.glob(os.path.join(kok, "gunluk", "20??-??-??*.md")), reverse=True)
    if gunler:
        ekle("gunluk", "gunluk/ (%d gün)" % len(gunler), "# Günlük — oturum notları\n\n" +
             "\n\n".join(re.sub(r"^# ", "## ", frontmatter(oku(p))[1], flags=re.M) for p in gunler),
             "arsiv", "cekirdek", gunler[0], ad="Günlük")
    sayfa_idler = {x[0] for x in D}
    tur_say, ciftler = {}, []
    gorulen_noron = set()
    for klasor in ("kural", "ders"):
        for p in sorted(glob.glob(os.path.join(kok, klasor, "*.md"))):
            metin = oku(p)
            fm, govde = frontmatter(metin)
            nid = fm.get("id") or os.path.basename(p)[:-3]
            if nid in gorulen_noron or nid in sayfa_idler:
                uyar("çift kimlik %s (%s) — atlandı; `beyin saglik` da bunu gösterir" % (nid, klasor))
                continue
            gorulen_noron.add(nid)
            bag = [tuple(x.strip() for x in b.split("=", 1)) if "=" in b else ("birlikte", b.strip())
                   for b in fm.get("bag", "").split(",") if b.strip()]
            kaynak = next((h for t, h in bag if t == "ayrinti"), "")
            h1 = next((t for _, sev, t in basliklar(govde) if sev == 1), nid)
            nt = fm.get("tur", klasor)
            tur_say[nt] = tur_say.get(nt, 0) + 1
            onbilgi = "> **%s** · tetik: %s · geçerlilik: %s%s\n\n" % (
                {"kural": "Kural", "ders": "Ders (tuzak)", "olgu": "Olgu"}.get(nt, nt), fm.get("tetik", "—"),
                fm.get("gecerlilik", "—"), (" · bağ: " + fm["bag"]) if fm.get("bag") else "")
            gecersiz = any(t == "yerine-gecti" for t, _ in bag)
            ekle(nid, klasor + "/" + os.path.basename(p), "---\nguncelleme: %s\n---\n" % fm.get("guncelleme", "") + onbilgi + govde,
                 "noron", alan_h.get(kaynak) or ("cekirdek" if not kaynak else "diger"), p, h1=h1, ad=kisa_ad(h1, nid, 30),
                 nt=nt, sert=bool(SERT.search(h1)), kaynak=kaynak, gecersiz=gecersiz)
            ciftler += [(nid, h) for _, h in bag]
    baslangic = tarih(ayar.get("baslangic")) or min([t for t in bilinen if t <= bugun] or [bugun])
    dugumler = []
    for id_, yol, fm, govde, katman, alan, gn, mt, ek in D:
        if alan not in alan_set:
            alanlar.append([alan, alan[:1].upper() + alan[1:]])
            alan_set.add(alan)
        dogum = min(metin_tarihleri(govde, baslangic, bugun) + [gn])
        if katman == "cekirdek":
            dogum = baslangic
        degisim = max(mt, dt.datetime.combine(gn, dt.time())).strftime("%Y-%m-%d %H:%M")
        dugumler.append(dugum(id_, yol, govde, katman, alan, maske, gn, max(baslangic, min(dogum, bugun)), degisim, **ek))
    for d in dugumler:
        if d["katman"] != "noron":
            ciftler += [(d["id"], h) for h in baglar(d["metin"])]
        if d["id"].endswith("-gecmis"):
            ciftler.append((d["id"], d["id"][:-7] if d["id"][:-7] in sayfa_idler else "index"))
    cek = [x for x in ("kurallar", "hot", "sozlesme", "index") if x in sayfa_idler]
    for i, a in enumerate(cek):     # çekirdek üçgeni / halkası
        ciftler += [(a, cek[(i + 1) % len(cek)])] * 2 if len(cek) > 1 else []
    ciftler += [("gunluk", "hot")] * 2 if "hot" in sayfa_idler else []
    kenarlar = kenar_say(dugumler, ciftler)
    tamamla(dugumler, kenarlar, "index")
    noron_say = sum(tur_say.values())
    veri = {"tur": "kasa", "ayar": {"gunes": "index", "nabiz": "hot" if giris else "index", "isListesi": ""},
            "durumlar": ayar.get("durumlar") or [["oncelik", "Öncelikli"], ["bende", "Bende (Claude)"], ["sende", "Sende"],
                                                 ["dista", "Dışarıdan bekleniyor"], ["askida", "Askıda"]],
            "alanlar": alanlar, "dugumler": dugumler, "kenarlar": kenarlar,
            "gorevler": gorevler_kasa(kok, maske, bugun), "bitenler": bitenler_kasa(kok, maske)}
    return veri, baslangic, {"noron": noron_say, "sayfa": len(dugumler) - noron_say, "turler": tur_say, "surum": "Beyin v4"}


# -------------------------------------------------------------------- ana ----
def oturum_say(klasor):
    return len([p for p in glob.glob(os.path.join(os.path.expanduser(klasor), "*", "*.jsonl")) if os.path.getsize(p) > 4000])


def uret(kok, cikti, kip="otomatik", kurallar=None, giris=False, sirlar=None, oturumlar=None, bugun=None, sayfa=None):
    del UYARILAR[:]
    kok = os.path.abspath(os.path.expanduser(kok))
    if not os.path.isdir(kok):
        sys.exit("Klasör yok: %s" % kok)
    kasa = kasa_mi(kok) if kip == "otomatik" else kip == "kasa"
    ayar = ayar_oku(os.path.join(kok, "canli.json" if kasa else "beyin.json"))
    if kasa and not ayar and os.path.exists(os.path.join(kok, "beyin.json")):
        ayar = ayar_oku(os.path.join(kok, "beyin.json"))
    bugun = tarih(bugun) or tarih(ayar.get("bugun")) or dt.date.today()
    sir_listesi = []
    if sirlar:
        sir_listesi = [s.strip() for s in oku(os.path.expanduser(sirlar)).splitlines() if s.strip() and not s.startswith("#")]
    maske = Maske(ayar.get("gizle", []), sir_listesi)
    if kasa:
        veri, baslangic, ek = kasa_modu(kok, ayar, maske, bugun, kurallar=kurallar, giris=giris)
    else:
        veri, baslangic = notlar_modu(kok, ayar, maske, bugun)
        ek = {"noron": len(veri["dugumler"])}
    D = veri["dugumler"]
    ist = dict(ek, sinaps=len(veri["kenarlar"]), karakter=sum(d["karakter"] for d in D),
               canli_karakter=sum(d["karakter"] for d in D if d["katman"] != "arsiv"),
               gun=(bugun - baslangic).days + 1, oturum=oturum_say(oturumlar) if oturumlar else ayar.get("oturum"),
               baslangic=baslangic.isoformat(), son_degisim=max(d["degisim"] for d in D),
               uretim=dt.datetime.now().strftime("%Y-%m-%d %H:%M"), bugun=bugun.isoformat())
    veri = dict({"surum": 3}, istatistik=ist, **veri)
    metin = "window.BEYIN = " + json.dumps(veri, ensure_ascii=False, separators=(",", ":")) + ";\n"
    # U+FFFD (bozuk karakter) ve U+2028/2029 JSON kaçışıyla yazılır: dosya baytça temiz kalır, anlam değişmez
    metin = metin.replace("\ufffd", "\\ufffd").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    if sayfa:
        sayfa = os.path.abspath(os.path.expanduser(sayfa))
        os.makedirs(sayfa, exist_ok=True)
        for f in SAYFA_DOSYALARI:
            shutil.copyfile(os.path.join(BURASI, f), os.path.join(sayfa, f))
        cikti = os.path.join(sayfa, "veri.js")
    os.makedirs(os.path.dirname(os.path.abspath(cikti)), exist_ok=True)
    with io.open(cikti, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(metin)
    return veri, cikti


def main(argv=None):
    for akis in (sys.stdout, sys.stderr):
        try:
            akis.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    ap = argparse.ArgumentParser(description="Not klasöründen ya da Beyin v4 kasasından Canlı Beyin verisi (veri.js) üretir.")
    ap.add_argument("klasor", help="kasa (ör. ~/beyin, ornek/kasa) ya da düz not klasörü (ör. ornek/notlar)")
    ap.add_argument("-o", "--cikti", default=os.path.join(BURASI, "veri.js"), help="çıktı (varsayılan: canli/veri.js)")
    ap.add_argument("--sayfa", help="sayfanın tamamını (index.html, beyin.css, beyin.js, veri.js) bu klasöre yaz")
    ap.add_argument("--kip", choices=("otomatik", "kasa", "notlar"), default="otomatik")
    ap.add_argument("--kurallar", help="kasa: bu CLAUDE.md çekirdekte 'Kurallar' yıldızı olsun (ör. ~/.claude/CLAUDE.md)")
    ap.add_argument("--giris", action="store_true", help="kasa: oturum başı çıktısını (`beyin giris`) çekirdeğe koy")
    ap.add_argument("--sirlar", help="maskelenecek bilinen sırlar listesi (satır başına bir dize; içeriği basılmaz)")
    ap.add_argument("--oturumlar", help="Claude Code oturum kayıtları klasörü; sayısı künyede görünür (ör. ~/.claude/projects)")
    ap.add_argument("--bugun", help="AAAA-AA-GG — üretimi bu güne sabitle (örnek/demo için)")
    a = ap.parse_args(argv)
    veri, cikti = uret(a.klasor, a.cikti, a.kip, a.kurallar, a.giris, a.sirlar, a.oturumlar, a.bugun, a.sayfa)
    i = veri["istatistik"]
    if veri["tur"] == "kasa":
        ozet = "%d nöron (%s) · %d sayfa" % (i["noron"], ", ".join("%d %s" % (n, k) for k, n in sorted(i["turler"].items())) or "—", i["sayfa"])
    else:
        ozet = "%d not" % i["noron"]
    print("OK %s — %s · %d sinaps · %s karakter · %d gün · %d açık iş · %d KB" % (
        cikti.replace("\\", "/"), ozet, i["sinaps"], "{:,}".format(i["karakter"]).replace(",", "."), i["gun"],
        len(veri["gorevler"]), os.path.getsize(cikti) // 1024))
    for u in UYARILAR:
        print("  ⚠️ " + u)
    print("   Aç: %s" % os.path.join(os.path.dirname(cikti), "index.html").replace("\\", "/")
          if a.sayfa else "   index.html'i tarayıcıda aç.")


if __name__ == "__main__":
    main()
