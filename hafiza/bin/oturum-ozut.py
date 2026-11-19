#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
oturum-ozut — bir günün ham oturum transkriptlerinden ÖZ çıkarır.

NEDEN VAR: ham transkriptler günde ~100 MB olabilir; hiçbir modele
olduğu gibi verilemez. Bu araç anlamlı sinyali süzer (kullanıcının ne
istediği · hangi dosyalar değişti · hangi komutlar koştu · ne commit'lendi)
ve iş günlüğü yazıcısına ~50 KB'lık bir öz verir.

Kullanım:
  oturum-ozut.py 2026-08-23              → o günün özü stdout'a
  oturum-ozut.py 2026-08-23 --istatistik → yalnız sayılar
"""
import json, sys, os, glob, re, collections, datetime

# BEYIN_OTURUM_KOK ile ezilebilir (testler kum havuzunu böyle kurar)
KOK = os.path.expanduser(os.environ.get("BEYIN_OTURUM_KOK") or "~/.claude/projects")
try:
    UTC_FARK = int(os.environ.get("BEYIN_UTC_FARK") or 3)
except ValueError:
    UTC_FARK = 3
# Sır sızmasın: öze giren her satır bu desenlerden geçer
SIR = re.compile(
    r'(base64:[A-Za-z0-9+/=]{20,}'
    r'|(?<![A-Za-z0-9])[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}'   # jwt
    r'|(?:password|passwd|parola|secret|token|api[_-]?key)\s*[:=]\s*\S+'
    r'|-----BEGIN[^-]+-----)', re.I)

def maskele(s):
    return SIR.sub("<SIR-MASKELENDI>", s or "")

def kirp(s, n):
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[:n] + "…"

def metin_topla(icerik):
    """message.content listesinden düz metin çıkar."""
    if isinstance(icerik, str):
        return icerik
    parcalar = []
    for c in icerik or []:
        if isinstance(c, dict) and c.get("type") == "text":
            parcalar.append(c.get("text", ""))
    return "\n".join(parcalar)

# Bir projede günde bu sayıdan çok oturum varsa insan çalışması değil, TOPLU
# AJAN KOŞUSUDUR (gerçek örnek: bir otomasyon turu tek günde 10.000+ oturum
# üretti). Tek satırda özetlenir, yoksa günlüğü boğar.
TOPLU_ESIK = 50

def gun_ozu(tarih):
    bas = datetime.datetime.strptime(tarih, "%Y-%m-%d")
    son = bas + datetime.timedelta(days=1)
    # önce dosyaları projeye göre topla
    proje_dosya = collections.defaultdict(list)
    for p in sorted(glob.glob(os.path.join(KOK, "*", "*.jsonl"))):
        if "/subagents/" in p:
            continue
        try:
            mt = datetime.datetime.fromtimestamp(os.path.getmtime(p))
        except OSError:
            continue
        if bas <= mt < son + datetime.timedelta(days=1):
            proje_dosya[os.path.basename(os.path.dirname(p))].append(p)

    oturumlar, toplu = [], []
    for proje, yollar in proje_dosya.items():
        if len(yollar) > TOPLU_ESIK:
            boyut = sum(os.path.getsize(y) for y in yollar)
            toplu.append(dict(proje=proje, adet=len(yollar), bayt=boyut))
            continue
        oturumlar.extend(_oturumlari_oku(yollar, tarih))
    return oturumlar, toplu

def _oturumlari_oku(yollar, tarih):
    oturumlar = []
    for p in yollar:
        baslik, istemler, dosyalar = None, [], collections.Counter()
        komutlar, commitler, ozetler = [], [], []
        arac = collections.Counter()
        ilk = sonz = None
        for satir in open(p, encoding="utf-8", errors="ignore"):
            try:
                o = json.loads(satir)
            except Exception:
                continue
            t = o.get("type")
            ts = o.get("timestamp", "")
            if ts and ts[:10] != tarih:
                continue
            if ts:
                ilk = ilk or ts; sonz = ts
            if t == "ai-title" and not baslik:
                baslik = o.get("aiTitle")
            elif t == "user" and not o.get("isSidechain"):
                m = (o.get("message") or {})
                if m.get("role") == "user":
                    g = metin_topla(m.get("content"))
                    # araç sonuçları ve sistem hatırlatmaları istem değildir
                    if g and not g.startswith(("<system-reminder", "[SYSTEM", "Caveat:")):
                        istemler.append(kirp(maskele(g), 300))
            elif t == "assistant":
                m = (o.get("message") or {})
                for c in m.get("content") or []:
                    if not isinstance(c, dict):
                        continue
                    if c.get("type") == "text" and len(c.get("text", "")) > 200:
                        ozetler.append(kirp(maskele(c["text"]), 400))
                    elif c.get("type") == "tool_use":
                        ad = c.get("name"); arac[ad] += 1
                        gir = c.get("input") or {}
                        if ad in ("Write", "Edit", "NotebookEdit") and gir.get("file_path"):
                            dosyalar[gir["file_path"]] += 1
                        elif ad == "Bash" and gir.get("command"):
                            k = kirp(maskele(gir["command"]), 160)
                            komutlar.append(k)
                            if re.search(r'\bgit\s+commit\b', k):
                                commitler.append(k)
        if istemler or dosyalar:
            oturumlar.append(dict(
                dosya=os.path.basename(p), baslik=baslik, ilk=ilk, son=sonz,
                istemler=istemler, dosyalar=dosyalar, komutlar=komutlar,
                commitler=commitler, ozetler=ozetler[-3:], arac=arac))
    return oturumlar

def bas(tarih, oturumlar, toplu, sadece_sayi=False):
    top_istem = sum(len(o["istemler"]) for o in oturumlar)
    top_dosya = collections.Counter()
    for o in oturumlar:
        top_dosya.update(o["dosyalar"])
    top_arac = collections.Counter()
    for o in oturumlar:
        top_arac.update(o["arac"])
    if sadece_sayi:
        ek = "".join(f" · [toplu] {t['proje']} {t['adet']} koşu" for t in toplu)
        print(f"{tarih}: {len(oturumlar)} oturum · {top_istem} istem · "
              f"{len(top_dosya)} dosya · {sum(top_arac.values())} araç çağrısı{ek}")
        return
    print(f"# Ham öz — {tarih}")
    print(f"\n{len(oturumlar)} oturum · {top_istem} kullanıcı isteği · "
          f"{len(top_dosya)} farklı dosya değişti · {sum(top_arac.values())} araç çağrısı")
    if toplu:
        print("\n## Toplu otomatik koşular (insan oturumu değil)")
        for t in toplu:
            print(f"- {t['proje']}: {t['adet']} ajan koşusu "
                  f"({t['bayt']//1024//1024} MB transkript)")
    if top_dosya:
        print("\n## En çok dokunulan dosyalar")
        for d, n in top_dosya.most_common(25):
            print(f"- {d} ({n}×)")
    for i, o in enumerate(oturumlar, 1):
        print(f"\n## Oturum {i}: {o['baslik'] or '(başlıksız)'}")
        print(f"saat {(o['ilk'] or '')[11:16]}–{(o['son'] or '')[11:16]} UTC · "
              f"{os.path.splitext(o['dosya'])[0][:8]}")
        if o["istemler"]:
            print("\n**Kullanıcı ne istedi:**")
            for s in o["istemler"][:12]:
                print(f"- {s}")
        if o["dosyalar"]:
            print("\n**Değişen dosyalar:** " +
                  ", ".join(f"{k}" for k, _ in o["dosyalar"].most_common(12)))
        if o["commitler"]:
            print("\n**Commit'ler:**")
            for c in o["commitler"][:8]:
                print(f"- {c}")
        if o["ozetler"]:
            print("\n**Kapanış özeti (asistan):**")
            for s in o["ozetler"][-2:]:
                print(f"- {s}")

if __name__ == "__main__":
    tarih = sys.argv[1] if len(sys.argv) > 1 else \
        (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=UTC_FARK)).strftime("%Y-%m-%d")
    ots, tpl = gun_ozu(tarih)
    bas(tarih, ots, tpl, "--istatistik" in sys.argv)
