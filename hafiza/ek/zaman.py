# -*- coding: utf-8 -*-
"""Zaman kavrami: ne zaman neyi konustuk?

Kaynak Claude Code'un kendi konusma kayitlari (~/.claude/projects/*/*.jsonl).
Her kullanici mesajinin zaman damgasi orada zaten duruyor; hafizaya elle
yazilmasini beklemeye gerek yok, yazilmasi unutulsa bile kayit eksiksizdir.

Kullanim:
  zaman.py                  son 7 gunun oturumlari (gun gun)
  zaman.py oturumlar [N]    son N gunun oturumlari
  zaman.py gun [TARIH]      o gunun butun mesajlari, saatiyle (varsayilan bugun)
                            TARIH: 2026-09-20 | dun | bugun
  zaman.py ara KELIME [N]   KELIME'nin gectigi mesajlar, en yeniden (varsayilan 20)
  zaman.py kanca-baslangic  SessionStart kancasi icin: su an + son oturumlar
  zaman.py kanca-mesaj      UserPromptSubmit kancasi icin: su anki saat (JSON)

Kayit klasoru BEYIN_OTURUM_KOK ile degisir (varsayilan ~/.claude/projects).
"""
import datetime as dt
import glob
import io
import json
import os
import re
import sys

KAYITLAR = os.path.expanduser(os.environ.get("BEYIN_OTURUM_KOK") or os.path.join("~", ".claude", "projects"))
GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]

# Kullanicinin yazmadigi, sistemin ekledigi mesajlar
GURULTU = re.compile(r"^\s*(<command-|<local-command|<system-reminder|<task-notification"
                     r"|Caveat:|\[Request interrupted|This session is being continued)")


def simdi():
    return dt.datetime.now().astimezone()


def yerel(ts):
    return dt.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone()


def gun_adi(t):
    return "%d %s %s" % (t.day, AYLAR[t.month - 1], GUNLER[t.weekday()])


def metin(icerik):
    if isinstance(icerik, str):
        return icerik
    if isinstance(icerik, list):
        return " ".join(x.get("text", "") for x in icerik
                        if isinstance(x, dict) and x.get("type") == "text")
    return ""


# Sohbete yazilmis sifreler bu aractan geri basilmasin. Harf + rakam iceren,
# ozel isaretli ya da buyuk-kucuk karisik 8+ karakterlik bosluksuz dizi = sir.
SIR = re.compile(r"(?<!\S)(?=\S*\d)(?=\S*[A-Za-z])(?=\S*([$&!%*#?+=@^~]|[a-z]\S*[A-Z]|[A-Z]\S*[a-z]))"
                 r"(?!https?:)(?!\S*[/\\])(?!\S*\.[A-Za-z]{2,5}(?!\S))\S{8,}")


def temizle(s):
    s = re.sub(r"<pasted_content[^>]*>.*?</pasted_content[^>]*>", "[yapıştırılan metin]", s, flags=re.S)
    s = SIR.sub("[gizlendi]", s)
    return re.sub(r"\s+", " ", s).strip()


def oturumlar(kac_gun=None):
    """Her oturum: baslangic, bitis, baslik, mesajlar[(zaman, metin)]."""
    sinir = simdi() - dt.timedelta(days=kac_gun) if kac_gun else None
    sonuc = []
    for yol in glob.glob(os.path.join(KAYITLAR, "*", "*.jsonl")):
        if sinir and dt.datetime.fromtimestamp(os.path.getmtime(yol)).astimezone() < sinir:
            continue
        baslik, mesajlar, son_ts = "", [], None
        try:
            fh = io.open(yol, encoding="utf-8")
        except OSError:
            continue
        with fh:
            for satir in fh:
                try:
                    d = json.loads(satir)
                except ValueError:
                    continue
                tur = d.get("type")
                if tur == "ai-title":
                    baslik = d.get("aiTitle") or baslik
                    continue
                ts = d.get("timestamp")
                if ts and tur in ("user", "assistant"):
                    son_ts = ts
                if tur != "user" or d.get("isMeta") or d.get("isSidechain") or not ts:
                    continue
                s = metin(d.get("message", {}).get("content"))
                if not s.strip() or GURULTU.match(s):
                    continue
                mesajlar.append((yerel(ts), temizle(s)))
        if not mesajlar:
            continue
        sonuc.append({
            "id": os.path.basename(yol)[:8],
            "klasor": os.path.basename(os.path.dirname(yol)),
            "bas": mesajlar[0][0],
            "son": yerel(son_ts) if son_ts else mesajlar[-1][0],
            "baslik": baslik,
            "mesajlar": mesajlar,
        })
    sonuc.sort(key=lambda o: o["bas"])
    if sinir:
        sonuc = [o for o in sonuc if o["son"] >= sinir]
    return sonuc


def kisalt(s, n):
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def once(t, an):
    fark = an - t
    saat = fark.total_seconds() / 3600
    if saat < 1:
        return "%d dk önce" % max(1, fark.total_seconds() // 60)
    if saat < 48:
        return "%d saat önce" % saat
    return "%d gün önce" % fark.days


def oturum_satiri(o, konu_sayisi=3, genislik=70):
    konular = [kisalt(m, genislik) for _, m in o["mesajlar"][:konu_sayisi]]
    return "- %s–%s · %d mesaj · **%s**\n    %s" % (
        o["bas"].strftime("%H:%M"), o["son"].strftime("%H:%M"), len(o["mesajlar"]),
        o["baslik"] or "(başlıksız)", " | ".join(konular))


def yaz_oturumlar(kac_gun):
    liste = oturumlar(kac_gun)
    if not liste:
        print("Son %d günde oturum yok." % kac_gun)
        return
    gun = None
    for o in liste:
        g = o["bas"].date()
        if g != gun:
            gun = g
            print("\n## %s" % gun_adi(o["bas"]))
        print(oturum_satiri(o))


def yaz_gun(tarih):
    an = simdi()
    if tarih in (None, "bugun", "bugün"):
        hedef = an.date()
    elif tarih in ("dun", "dün"):
        hedef = an.date() - dt.timedelta(days=1)
    else:
        hedef = dt.date.fromisoformat(tarih)
    kac = (an.date() - hedef).days + 2
    for o in oturumlar(kac):
        ms = [(t, m) for t, m in o["mesajlar"] if t.date() == hedef]
        if not ms:
            continue
        print("\n## %s · %s" % (o["baslik"] or "(başlıksız)", o["id"]))
        for t, m in ms:
            print("  %s  %s" % (t.strftime("%H:%M"), kisalt(m, 160)))


def yaz_ara(kelime, adet):
    k = kelime.casefold()
    bulunan = []
    for o in oturumlar():
        for t, m in o["mesajlar"]:
            if k in m.casefold():
                bulunan.append((t, o["baslik"], m))
    bulunan.sort(key=lambda x: x[0], reverse=True)
    if not bulunan:
        print("'%s' hiçbir mesajda geçmiyor." % kelime)
        return
    for t, b, m in bulunan[:adet]:
        i = m.casefold().find(k)
        parca = m[max(0, i - 50): i + 110]
        print("%s %s  [%s]\n    %s" % (gun_adi(t), t.strftime("%H:%M"), b or "-", parca))
    if len(bulunan) > adet:
        print("\n(%d sonuçtan %d tanesi gösterildi)" % (len(bulunan), adet))


def an_satiri(an):
    fark = an.utcoffset().total_seconds() / 3600 if an.utcoffset() is not None else 0
    return "Şu an: %s %d %s %d, saat %s (yerel saat, UTC%+g)" % (
        GUNLER[an.weekday()], an.day, AYLAR[an.month - 1], an.year, an.strftime("%H:%M"), fark)


def kanca_baslangic():
    an = simdi()
    # acilan oturumun kendisi (devam ettirilen oturumda dolu olabilir) listelenmez
    try:
        acik = json.load(sys.stdin).get("session_id", "")[:8]
    except Exception:
        acik = ""
    liste = [o for o in oturumlar(4) if o["id"] != acik]
    parca = ["# Zaman", "", an_satiri(an)]
    if liste:
        son = max(liste, key=lambda o: o["son"])
        parca.append("Son oturum %s bitti (%s, %s)." % (
            once(son["son"], an), gun_adi(son["son"]), son["son"].strftime("%H:%M")))
        parca += ["", "Son oturumlar (ayrıntı: `python \"%s\" gun dun` ya da `ara <kelime>`):"
                  % os.path.abspath(__file__).replace("\\", "/")]
        gun = None
        for o in liste[-6:]:
            if o["bas"].date() != gun:
                gun = o["bas"].date()
                parca.append("**%s**" % gun_adi(o["bas"]))
            parca.append(oturum_satiri(o, konu_sayisi=2, genislik=60))
    print("\n".join(parca))


def kanca_mesaj():
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": an_satiri(simdi()),
    }}, ensure_ascii=False))


def main(arg):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass
    komut = arg[0] if arg else "oturumlar"
    if komut == "oturumlar":
        yaz_oturumlar(int(arg[1]) if len(arg) > 1 else 7)
    elif komut == "gun":
        yaz_gun(arg[1] if len(arg) > 1 else None)
    elif komut == "ara" and len(arg) > 1:
        yaz_ara(arg[1], int(arg[2]) if len(arg) > 2 else 20)
    elif komut == "kanca-baslangic":
        kanca_baslangic()
    elif komut == "kanca-mesaj":
        kanca_mesaj()
    else:
        print(__doc__)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception as e:  # kanca asla oturumu bozmamali
        if sys.argv[1:2] and sys.argv[1].startswith("kanca"):
            sys.exit(0)
        raise
