"""Uçtan uca ölçüm: sınav cümlelerini ÇALIŞAN anlam servisinin kanca girişinden (KANCAJ) geçirir,
kancanın Claude'a vereceği metni ayrıştırır (24.10.2026).

Ölçülen: hedef nöron gövdeyle mi (───), 🧭 başlıkla mı geldi; mesaj başına bağlam (bayt);
sohbet mesajında gövde gürültüsü; güvenlik ZORUNLU; 📓 geçmiş sorusunda hedef not.
Kullanım: python uctan_uca.py
"""
import os, sys, re, json, glob, socket, time, hashlib
for a in (sys.stdout, sys.stderr):
    a.reconfigure(encoding="utf-8", errors="replace")
OLCUM = os.path.dirname(os.path.abspath(__file__))

def kanca(mesaj):
    s = socket.create_connection(("127.0.0.1", 7341), timeout=20)
    s.sendall(("KANCAJ " + json.dumps({"prompt": mesaj}) + "\n").encode())
    d = b""
    while not d.endswith(b"\n"):
        p = s.recv(65536)
        if not p:
            break
        d += p
    s.close()
    c = d.decode("utf-8").strip()
    if c == "YOK":
        return [], [], "", 0
    metin = json.loads(c)["hookSpecificOutput"]["additionalContext"]
    govde = re.findall(r"^─── ([a-z0-9-]+)", metin, re.M)
    liste = re.findall(r"^   • ([a-z0-9-]+) — ", metin, re.M)
    return govde, liste, metin, len(metin.encode("utf-8"))

bol = lambda nid: "ayar" if int(hashlib.md5(nid.encode()).hexdigest(), 16) % 2 == 0 else "sinav"
hedefli = []
for p in sorted(glob.glob(os.path.join(OLCUM, "paket-*.tsv"))):
    for s in open(p, encoding="utf-8"):
        c = s.rstrip("\n").split("\t")
        if len(c) >= 3 and c[2].strip() != "SKIP" and bol(c[0]) == "sinav":
            hedefli.append((c[0], c[1], c[2].strip()))
# birleştirilen (arşive giden) nöronların sınav cümleleri yeni sahibine sayılır:
# OLCUM/katildi.tsv  <eski id> TAB <yeni id>   (isteğe bağlı)
KATILDI = {}
if os.path.exists(os.path.join(OLCUM, "katildi.tsv")):
    for s in open(os.path.join(OLCUM, "katildi.tsv"), encoding="utf-8"):
        c = s.rstrip("\n").split("\t")
        if len(c) == 2 and not s.startswith("#"):
            KATILDI[c[0]] = c[1]
t = time.time()
kova = {}
for hedef, cesit, mesaj in hedefli:
    hedef = KATILDI.get(hedef, hedef)
    g, l, _, b = kanca(mesaj)
    k = kova.setdefault(cesit, dict(n=0, tam=0, hat=0, bayt=0, govde=0))
    k["n"] += 1; k["tam"] += hedef in g; k["hat"] += hedef in g or hedef in l
    k["bayt"] += b; k["govde"] += len(g)
for cesit, k in sorted(kova.items()):
    n = k["n"]
    print(f"SINAV {cesit:<8} n={n}: hedef gövdeyle %{k['tam']/n*100:.1f} · gövde ya da 🧭 başlıkla %{k['hat']/n*100:.1f} · "
          f"{k['govde']/n:.1f} gövde/mesaj · ~{k['bayt']/n/1000:.1f} KB/mesaj")
gen = [l.split("\t") for l in open(os.path.join(OLCUM, "genel.tsv"), encoding="utf-8") if l.strip() and not l.startswith("#")]
gg = [kanca(c[0]) for c in gen]
print(f"SOHBET n={len(gen)}: gövde gürültüsü %{sum(bool(g) for g, _, _, _ in gg)/len(gg)*100:.0f} · "
      f"herhangi bir çıktı %{sum(b > 0 for *_, b in gg)/len(gg)*100:.0f} · ~{sum(b for *_, b in gg)/len(gg)/1000:.2f} KB/mesaj")
zor = kac = 0
for k in ("kume", "holdout", "sinav", "final"):
    for s in open(os.path.join(OLCUM, "guvenlik", k + ".tsv"), encoding="utf-8"):
        if s.strip() and not s.startswith("#"):
            c = s.rstrip("\n").split("\t")
            z = {x.strip() for x in (c[1] if len(c) > 1 else "").split(",") if x.strip()}
            g, *_ = kanca(c[0]); zor += len(z); kac += len(z - set(g))
print(f"GÜVENLİK: ZORUNLU {zor} kural, gövdeyle gelmeyen {kac} → recall %{(zor-kac)/zor*100:.0f}")
ep_hit = ep_n = 0
for s in open(os.path.join(OLCUM, "epizodik.tsv"), encoding="utf-8"):
    c = s.rstrip("\n").split("\t")
    if len(c) < 3:
        continue
    *_, metin, _ = kanca(c[2])
    hedefler = [x.strip() for x in (c[0], c[1]) if x.strip()]
    # 📓 satırı "DD.MM günlük: [SS:DD] …" — hedef notun günü ve saati satırda mı
    ok = False
    for h in hedefler:
        gun, _, no = h.partition(".md#")
        kasa = os.path.expanduser(os.environ.get("BEYIN_KASA") or "~/beyin")
        satir = open(os.path.join(kasa, "gunluk", gun + ".md"), encoding="utf-8").read().splitlines()[int(no) - 1]
        saat = re.match(r"^- \[(\d{1,2}:\d{2})\]", satir)
        etiket = f"{gun[8:10]}.{gun[5:7]} günlük: [{saat.group(1)}]" if saat else None
        ok |= bool(etiket and etiket in metin)
    ep_n += 1; ep_hit += ok
print(f"📓 GEÇMİŞ SORUSU n={ep_n}: hedef günlük notu kancada %{ep_hit/ep_n*100:.0f}")
print(f"(süre {time.time()-t:.0f} sn)")
