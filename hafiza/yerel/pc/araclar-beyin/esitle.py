#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
esitle — sunucudaki hafıza kasasını bu PC'ye SALT OKUNUR ayna olarak eşitler
(Beyin v4).

NEDEN: ikinci bilgisayardaki her istemde hafıza kancası sunucuya SSH ile
bağlanıp ~1,4 sn bekliyordu; anlam modeli de sunucunun işlemcisini yoruyordu.
Kasanın bir aynası burada durur; ateşleme ve anlam araması yerelde yapılır.
⚠️ Ayna, kasadaki her metni bu bilgisayara getirir: yalnız güvendiğin bilgisayarda kur.

⛔ TEK YAZMA YERİ SUNUCUDUR. Bu aynada değişiklik yapılmaz — bir sonraki
eşitlemede ezilir. Yazmak için: bash .claude/kancalar/beyin.sh ekle|yeni …
(iki yazılabilir kopya birbirini ezer.)

Yöntem (rsync yok, Git Bash'te kurulu değil):
  1. Tek SSH çağrısı: sunucudaki dosya listesi (yol, boyut, mtime).
  2. Fark varsa ikinci SSH çağrısı: yalnız değişen dosyalar tek tar akışıyla.
  3. Sunucuda artık olmayan dosyalar aynadan silinir.
Kullanım: esitle.py [--sessiz]      çıkış kodu 0 = tamam, 1 = sunucuya ulaşılamadı

Ayar (ortam değişkeni; yoksa .claude/kancalar/ayar.sh'teki SUNUCU):
  BEYIN_SUNUCU        ~/.ssh/config'teki Host kısayolu
  BEYIN_UZAK_KASA     sunucuda kasa (ev klasörüne göreli)    varsayılan beyin
  BEYIN_UZAK_TARIHCE  sunucuda aylık tarihçe                varsayılan beyin-arsiv/proje-tarihcesi
  BEYIN_AYNA_ASGARI   sunucu listesi bundan kısaysa arıza say, aynayı silme   varsayılan 5
"""
import os, sys, io, time, tarfile, subprocess, shutil
for _a in (sys.stdout, sys.stderr):          # Windows konsolu cp1254: ✓ basamıyordu
    try:
        _a.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))     # araclar/beyin
AYNA = os.environ.get("BEYIN_KASA", os.path.join(KOK, "kasa"))
KILIT = os.path.join(KOK, "durum", "esitle.kilit")
ASGARI = int(os.environ.get("BEYIN_AYNA_ASGARI", "5"))

def ayar_sunucu():
    """ayar.sh'teki SUNUCU= satırı (<çalışma klasörü>/.claude/kancalar/ayar.sh)."""
    yol = os.path.join(os.path.dirname(os.path.dirname(KOK)), ".claude", "kancalar", "ayar.sh")
    try:
        for s in open(yol, encoding="utf-8"):
            if s.startswith("SUNUCU="):
                return s.split("=", 1)[1].strip().strip("\"'")
    except OSError:
        pass
    return "beyin-sunucu"

SUNUCU = os.environ.get("BEYIN_SUNUCU") or ayar_sunucu()
# sunucuda ev klasörüne göreli kaynaklar → aynadaki yerleri
KAYNAK = {os.environ.get("BEYIN_UZAK_KASA", "beyin").strip("/"): "",
          os.environ.get("BEYIN_UZAK_TARIHCE", "beyin-arsiv/proje-tarihcesi").strip("/"): "_tarihce"}
UZANTI = (".md", ".tsv")

def ssh_yolu():
    for p in (r"C:\Program Files\Git\usr\bin\ssh.exe", "/usr/bin/ssh"):
        if os.path.exists(p):
            return p
    return "ssh"

# ⚠️ Servis penceresiz (pythonw) çalışıyor; penceresiz süreçten başlatılan konsol programı
# (Git'in ssh.exe'si) Windows'ta HER SEFERİNDE yeni bir konsol penceresi açar (3 dk'da bir
# eşitlemede ekranda terminal belirip kaybolur). CREATE_NO_WINDOW şart.
GIZLI = 0x08000000 if os.name == "nt" else 0

def ssh(komut, girdi=None, zaman=60):
    ek = {"input": girdi} if girdi is not None else {"stdin": subprocess.DEVNULL}
    return subprocess.run([ssh_yolu(), "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8",
                           SUNUCU, komut], capture_output=True, timeout=zaman, creationflags=GIZLI, **ek)

def yerel_yol(sunucu_goreli):
    """'beyin/kural/x.md' → <ayna>/kural/x.md ; tarihçe → <ayna>/_tarihce/…"""
    for kaynak, hedef in KAYNAK.items():
        if sunucu_goreli.startswith(kaynak + "/"):
            alt = sunucu_goreli[len(kaynak) + 1:]
            return os.path.join(AYNA, hedef, *alt.split("/"))
    return None

def kilitle():
    os.makedirs(os.path.dirname(KILIT), exist_ok=True)
    try:
        if os.path.exists(KILIT) and time.time() - os.path.getmtime(KILIT) > 300:
            os.remove(KILIT)                       # 5 dk'dan eski kilit bayattır
        fd = os.open(KILIT, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
        return True
    except FileExistsError:
        return False

def esitle(sessiz=False):
    t = time.time()
    r = ssh("cd ~ && for k in " + " ".join(KAYNAK) + "; do test -d \"$k\" && "
            "find \"$k\" -type f \\( -name '*.md' -o -name '*.tsv' \\) -not -path '*/.git/*' "
            "-printf '%p\\t%s\\t%T@\\n'; done")
    if r.returncode != 0:
        if not sessiz:
            print("⚠️ sunucuya ulaşılamadı — ayna eşitlenmedi", file=sys.stderr)
        return 1
    sunucu = {}
    for satir in r.stdout.decode("utf-8", "replace").splitlines():
        p = satir.split("\t")
        if len(p) == 3 and p[0].endswith(UZANTI):
            sunucu[p[0]] = (int(p[1]), float(p[2]))
    if len(sunucu) < ASGARI:       # boş/kısa liste = arıza, aynayı SİLME
        print(f"⚠️ sunucu listesi şüpheli kısa ({len(sunucu)} dosya) — eşitleme atlandı", file=sys.stderr)
        return 1
    gerek = []
    for yol, (boyut, mtime) in sunucu.items():
        y = yerel_yol(yol)
        try:
            st = os.stat(y)
            if st.st_size == boyut and abs(st.st_mtime - mtime) < 2:
                continue
        except OSError:
            pass
        gerek.append(yol)
    if gerek:
        r = ssh("cd ~ && tar cf - -T -", girdi="\n".join(gerek).encode("utf-8"), zaman=300)
        if r.returncode != 0:
            print("⚠️ dosyalar çekilemedi", file=sys.stderr)
            return 1
        with tarfile.open(fileobj=io.BytesIO(r.stdout), mode="r:") as tar:
            for uye in tar.getmembers():
                if not uye.isfile():
                    continue
                hedef = yerel_yol(uye.name)
                if not hedef or not os.path.abspath(hedef).startswith(os.path.abspath(AYNA)):
                    continue                        # beklenmeyen yol: atla
                os.makedirs(os.path.dirname(hedef), exist_ok=True)
                gecici = hedef + ".esitle"
                with tar.extractfile(uye) as kaynak, open(gecici, "wb") as f:
                    shutil.copyfileobj(kaynak, f)
                os.utime(gecici, (uye.mtime, uye.mtime))
                os.replace(gecici, hedef)
    # sunucuda olmayanı sil (arşive taşınan nöron burada da yer değiştirsin)
    beklenen = {os.path.normcase(os.path.abspath(yerel_yol(y))) for y in sunucu}
    silinen = 0
    for kok, _, dosyalar in os.walk(AYNA):
        for d in dosyalar:
            p = os.path.join(kok, d)
            if d.endswith(UZANTI) and os.path.normcase(os.path.abspath(p)) not in beklenen:
                os.remove(p); silinen += 1
    if not sessiz:
        print(f"✓ ayna eşitlendi: {len(sunucu)} dosya · {len(gerek)} yeni/değişen · {silinen} silinen "
              f"({time.time()-t:.1f} sn)")
    return 0

if __name__ == "__main__":
    if not kilitle():
        sys.exit(0)                                 # başka bir eşitleme sürüyor
    try:
        sys.exit(esitle("--sessiz" in sys.argv))
    finally:
        try:
            os.remove(KILIT)
        except OSError:
            pass
