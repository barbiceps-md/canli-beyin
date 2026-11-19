"""Hafızaya işlenmemiş oturum sayısı (isteğe bağlı: <kasa>/durum-ek.sh çağırabilir).

Ölçü: kasadaki en son günlük notundan (gunluk/*.md değişme zamanı) SONRA biten,
en az 2 kullanıcı mesajlı oturumlar. Şu an açık olan (en son biten) oturum sayılmaz.
Çıktı tek satır: "<sayı> <en eski başlangıç dd.mm HH:MM>" ya da "0".
"""
import glob, os, sys, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import zaman

kasa = os.path.expanduser(os.environ.get("BEYIN_KASA") or "~/beyin")
notlar = glob.glob(os.path.join(kasa, "gunluk", "*.md"))
if not notlar:
    print("0"); sys.exit(0)
son_not = dt.datetime.fromtimestamp(max(os.path.getmtime(p) for p in notlar), dt.timezone.utc)
# Yalnız son nottan SONRA değişen kayıtlar okunur (1,7 GB'ın tamamını okumak 4,7 sn sürüyordu).
gun = max((dt.datetime.now(dt.timezone.utc) - son_not).total_seconds() / 86400, 1e-6)
liste = sorted(zaman.oturumlar(gun), key=lambda o: o["son"])
liste = liste[:-1]                         # açık oturum
sonra = [o for o in liste if o["son"].astimezone(dt.timezone.utc) > son_not and len(o["mesajlar"]) >= 2]
if not sonra:
    print("0")
else:
    ilk = min(o["bas"] for o in sonra)
    print(f"{len(sonra)} {ilk:%d.%m %H:%M}")
