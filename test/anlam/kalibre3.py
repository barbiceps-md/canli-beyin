"""İki kademeli seçimin (tam gövde + 🧭 başlık + 📓 kayıt) ölçümü ve eşik ayarı (24.10.2026, PC/GPU).

`beyin` kodundaki anlam_secimi / kayit_secimi fonksiyonlarının KENDİSİ çağrılır.
Ölçütler:
  tam        hedef nöron gövdesiyle basıldı mı
  hatırlatma hedef ya gövdeyle ya 🧭 başlık satırında geldi mi (başlık = kuralın kendisi)
  maliyet    mesaj başına bağlama giren karakter (gövde + başlık satırı + kayıt satırı)
Şartlar (AYAR kümesinde): güvenlik ZORUNLU %100 gövdeyle · sohbet mesajında gövde
gürültüsü ≤ %4 · sohbet mesajında 🧭 çıkma oranı ≤ %35 · hedefli mesajda ≤ 2 gövde.
Kullanım: python kalibre3.py <kod klasörü> <model> [<model> …]
"""
import os, sys, glob, json, hashlib, itertools, time
import importlib.machinery, importlib.util

OLCUM = os.path.dirname(os.path.abspath(__file__))
KOD, MODELLER = sys.argv[1], sys.argv[2:]
KOK = os.path.dirname(os.path.abspath(KOD))
os.environ.update(BEYIN_KASA=os.path.join(KOK, "kasa"), BEYIN_DIS_KAYNAK=os.path.join(KOK, "kasa", "_tarihce"),
                  HF_HOME=os.path.join(KOK, "hf"), HF_HUB_OFFLINE="1", BEYIN_ANLAM="0")
for a in (sys.stdout, sys.stderr):
    a.reconfigure(encoding="utf-8", errors="replace")

def yukle(ad, yol):
    l = importlib.machinery.SourceFileLoader(ad, yol)
    s = importlib.util.spec_from_loader(ad, l)
    m = importlib.util.module_from_spec(s); l.exec_module(m)
    return m

B = yukle("beyin_mod", os.path.join(KOD, "beyin"))
import numpy as np, torch
from sentence_transformers import SentenceTransformer

hepsi = B.noronlar(); ids = sorted(hepsi); sira = {n: i for i, n in enumerate(ids)}
govde_uz = {n: len(hepsi[n]["govde"]) for n in ids}
bol = lambda nid: "ayar" if int(hashlib.md5(nid.encode()).hexdigest(), 16) % 2 == 0 else "sinav"
hedefli, genel, guvenlik, epiz = [], [], [], []
for p in sorted(glob.glob(os.path.join(OLCUM, "paket-*.tsv"))):
    for s in open(p, encoding="utf-8"):
        c = s.rstrip("\n").split("\t")
        if len(c) >= 3 and c[2].strip() != "SKIP" and c[0] in hepsi:
            hedefli.append(dict(mesaj=c[2].strip(), hedef=c[0], cesit=c[1], bolum=bol(c[0])))
for s in open(os.path.join(OLCUM, "genel.tsv"), encoding="utf-8"):
    if s.strip() and not s.startswith("#"):
        c = s.rstrip("\n").split("\t")
        genel.append(dict(mesaj=c[0], kabul={x.strip() for x in (c[2] if len(c) > 2 else "").split(",") if x.strip()}))
for k in ("kume", "holdout", "sinav", "final"):
    for s in open(os.path.join(OLCUM, "guvenlik", k + ".tsv"), encoding="utf-8"):
        if s.strip() and not s.startswith("#"):
            c = s.rstrip("\n").split("\t")
            guvenlik.append(dict(mesaj=c[0], zorunlu={x.strip() for x in (c[1] if len(c) > 1 else "").split(",") if x.strip()},
                                 kabul={x.strip() for x in (c[2] if len(c) > 2 else "").split(",") if x.strip()}))
def gid(x):
    d, _, n = x.strip().partition(".md#"); return f"g:{d}#{int(n) - 1}"
for s in open(os.path.join(OLCUM, "epizodik.tsv"), encoding="utf-8"):
    c = s.rstrip("\n").split("\t")
    if len(c) >= 3:
        epiz.append(dict(mesaj=c[2], hedef={gid(c[0])} | ({gid(c[1])} if c[1].strip() else set())))
tum = hedefli + genel + guvenlik + epiz
for x in tum:
    guclu, zayif = B.sozcuk_eslesmeleri(B.sadelestir(x["mesaj"]), hepsi)
    x["guclu"], x["kelime"] = guclu, len(x["mesaj"].split())
    es = B.eski_secim(guclu, zayif)
    x["eski"] = [n["id"] for _, _, n in es[0]] if es else []
    x["eski_anilan"] = [n["id"] for n in es[1]] if es else []

def sec(x, ayar):
    v, l, _ = B.anlam_secimi(x["guclu"], x["anlam"], hepsi, ayar, kelime=x["kelime"])
    return [n["id"] for _, _, n in v], [n["id"] for n in l]

def olc(ayar, bolum):
    r = {}
    for cesit in ("dogal", "dolayli"):
        kume = [x for x in hedefli if x["bolum"] == bolum and x["cesit"] == cesit]
        s = [sec(x, ayar) for x in kume]
        r[cesit + "_tam"] = np.mean([x["hedef"] in v for x, (v, l) in zip(kume, s)])
        r[cesit + "_hat"] = np.mean([x["hedef"] in v or x["hedef"] in l for x, (v, l) in zip(kume, s)])
        r[cesit + "_govde"] = np.mean([len(v) for v, l in s])
        r[cesit + "_kar"] = np.mean([sum(govde_uz[i] for i in v) + 120 * len(l) for v, l in s])
    gs = [sec(x, ayar) for x in genel]
    r["genel_govde_gur"] = np.mean([bool([i for i in v if i not in x["kabul"]]) for x, (v, l) in zip(genel, gs)])
    r["genel_liste"] = np.mean([bool(l) for v, l in gs])
    r["genel_kar"] = np.mean([sum(govde_uz[i] for i in v) + 120 * len(l) for v, l in gs])
    zor = kac = 0
    for x in guvenlik:
        v, _ = sec(x, ayar); zor += len(x["zorunlu"]); kac += len(x["zorunlu"] - set(v))
    r["guv_recall"] = (zor - kac) / zor
    r["ort_hat"] = (r["dogal_hat"] + r["dolayli_hat"]) / 2
    r["ort_tam"] = (r["dogal_tam"] + r["dolayli_tam"]) / 2
    return r

def eski_olc(bolum):
    r = {}
    for cesit in ("dogal", "dolayli"):
        kume = [x for x in hedefli if x["bolum"] == bolum and x["cesit"] == cesit]
        r[cesit + "_tam"] = np.mean([x["hedef"] in x["eski"] for x in kume])
        r[cesit + "_hat"] = np.mean([x["hedef"] in x["eski"] or x["hedef"] in x["eski_anilan"] for x in kume])
        r[cesit + "_govde"] = np.mean([len(x["eski"]) for x in kume])
        r[cesit + "_kar"] = np.mean([sum(govde_uz[i] for i in x["eski"]) for x in kume])
    r["genel_govde_gur"] = np.mean([bool([i for i in x["eski"] if i not in x["kabul"]]) for x in genel])
    r["genel_liste"], r["genel_kar"] = 0.0, np.mean([sum(govde_uz[i] for i in x["eski"]) for x in genel])
    r["guv_recall"] = 1.0
    return r

def yaz(ad, r):
    print(f"  {ad:<44} doğal tam %{r['dogal_tam']*100:4.1f} hatırlatma %{r['dogal_hat']*100:4.1f} · "
          f"dolaylı tam %{r['dolayli_tam']*100:4.1f} hat %{r['dolayli_hat']*100:4.1f} · gövde/msj "
          f"{(r['dogal_govde']+r['dolayli_govde'])/2:.1f} · ~{(r['dogal_kar']+r['dolayli_kar'])/2/1000:.1f} KB/msj · "
          f"sohbet: gövde gür. %{r['genel_govde_gur']*100:.0f}, 🧭 %{r['genel_liste']*100:.0f}, "
          f"~{r['genel_kar']/1000:.2f} KB · güv %{r['guv_recall']*100:.0f}", flush=True)

for b in ("ayar", "sinav"):
    yaz(f"ESKİ (yalnız tetik) [{b}]", eski_olc(b))
ozet = {}
for MODEL in MODELLER:
    os.environ["BEYIN_ANLAM_MODEL"] = MODEL
    A = yukle("anlam_" + hashlib.md5(MODEL.encode()).hexdigest()[:6], os.path.join(KOD, "beyin-anlam"))
    qo, po = A.ONEK
    print(f"\n══ {MODEL}", flush=True)
    m = SentenceTransformer(MODEL, device="cuda", model_kwargs={"dtype": torch.float16}); m.max_seq_length = 512
    kod = lambda xs, o: m.encode([o + x for x in xs], batch_size=32, normalize_embeddings=True,
                                 convert_to_numpy=True).astype("float32")
    P = kod([A.noron_metni(hepsi[i]["fm"], hepsi[i]["govde"]) for i in ids], po)
    parcalar = A.kulliyat()
    epid = sorted(p for p in parcalar if p[0] in "goika")
    E = kod([parcalar[p] for p in epid], po)
    Q = kod([x["mesaj"][:1500] for x in tum], qo)
    tip = {}
    for j, p in enumerate(epid):
        tip.setdefault(p[0], []).append(j)
    for x, q in zip(tum, Q):
        s = P @ q
        en = np.argsort(-s)[:40]
        x["anlam"] = {"sonuc": [["n:" + ids[i], float(s[i])] for i in en],
                      "ist": {"n": [float(s.mean()), float(s.std())]},
                      "ozel": {"n:" + g[2]["id"]: float(s[sira[g[2]["id"]]]) for g in x["guclu"]}}
        se = E @ q; son, ist = [], {}
        for t_, js in tip.items():
            sv = se[js]; ist[t_] = [float(sv.mean()), float(sv.std())]
            for k in np.argsort(-sv)[:12]:
                son.append([epid[js[k]], float(sv[k]), parcalar[epid[js[k]]][:400]])
        son.sort(key=lambda r_: -r_[1])
        x["kayit"] = {"sonuc": son[:12], "ist": ist}
    del m; torch.cuda.empty_cache()
    sonuc = []
    for za, zt, hg, tv, zl, mk in itertools.product([3.0, 3.3, 3.6, 3.9, 4.2, 4.5, 5.0], [0.0, 1.0, 2.0],
                                                    [4.0, 99.0], [2, 3], [1.5, 2.0, 2.5, 3.0, 3.5, 4.0], [0, 3, 4]):
        ayar = dict(Z_ANLAM=za, Z_TEYIT=zt, HAM_GUCLU=hg, TAVAN=tv, Z_LISTE=zl, MIN_KELIME=mk, LISTE_ADET=5)
        sonuc.append((ayar, olc(ayar, "ayar")))
    uygun = [(a, r) for a, r in sonuc if r["guv_recall"] == 1.0 and r["genel_govde_gur"] <= 0.04
             and r["genel_liste"] <= 0.35 and r["dogal_govde"] <= 2.0 and r["dolayli_govde"] <= 2.0]
    uygun.sort(key=lambda ar: (-round(ar[1]["ort_hat"], 3), -round(ar[1]["ort_tam"], 3),
                               ar[1]["dogal_kar"] + ar[1]["dolayli_kar"]))
    print(f"  ızgara {len(sonuc)}, şartı sağlayan {len(uygun)}; en iyi 3 (AYAR):")
    for a, r in uygun[:3]:
        yaz(" ".join(f"{k}={v}" for k, v in a.items() if k != "LISTE_ADET"), r)
    if not uygun:
        continue
    secilen = uygun[0][0]
    rs = olc(secilen, "sinav")
    yaz("SEÇİLEN → SINAV (dokunulmadı)", rs)
    # 📓 kayıt eşiği: sohbet mesajında kayıt çıkma ≤ %15
    en_kayit = None
    for zk in (3.4, 3.6, 3.8, 4.0, 4.2, 4.4, 4.6, 5.0):
        a = dict(secilen, Z_KAYIT=zk, KAYIT_ADET=2)
        gk = np.mean([bool(B.kayit_secimi(x["kayit"], a)) if x["kelime"] >= secilen["MIN_KELIME"] else False
                      for x in genel])
        ek = np.mean([bool(x["hedef"] & {p for _, p, _ in B.kayit_secimi(x["kayit"], a)}) for x in epiz])
        print(f"  📓 Z_KAYIT={zk}: sohbet mesajında kayıt %{gk*100:4.1f} · geçmiş sorusunda hedef not geldi %{ek*100:4.1f}",
              flush=True)
        if en_kayit is None and gk <= 0.15:
            en_kayit = (zk, ek, gk)
    ozet[MODEL] = dict(ayar=dict(secilen, Z_KAYIT=en_kayit[0] if en_kayit else 4.4, KAYIT_ADET=2),
                       sinav={k: float(v) for k, v in rs.items()}, kayit=en_kayit)
json.dump(ozet, open(os.path.join(OLCUM, "kalibre3-ozet.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
