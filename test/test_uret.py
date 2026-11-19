# -*- coding: utf-8 -*-
"""Canlı Beyin veri üreticisinin (canli/uret.py) testleri — yalnız standart kütüphane.

    python -m unittest discover -s test -p "test_*.py" -v
Her test kendi geçici klasöründe çalışır; depodaki örnekler yalnız OKUNUR.
"""
import contextlib
import filecmp
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(KOK, "canli"))
import uret  # noqa: E402


def yaz(klasor, yol, metin, kodlama="utf-8"):
    p = os.path.join(klasor, yol)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "wb") as f:
        f.write(metin.encode(kodlama) if isinstance(metin, str) else metin)
    return p


def veri_oku(yol):
    with io.open(yol, encoding="utf-8") as f:
        s = f.read()
    assert s.startswith("window.BEYIN = ") and s.endswith(";\n")
    return json.loads(s[len("window.BEYIN = "):-2]), s


class Temel(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.cikti = os.path.join(self.d, "cikti", "veri.js")

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def uret(self, klasor, **k):
        with contextlib.redirect_stdout(io.StringIO()):
            uret.uret(klasor, self.cikti, **k)
        return veri_oku(self.cikti)

    def tutarli(self, v):
        """Her kenarın iki ucu var, her düğümün konumu 3 sayı, her alan tanımlı."""
        idler = {d["id"] for d in v["dugumler"]}
        self.assertEqual(len(idler), len(v["dugumler"]), "kimlikler benzersiz olmalı")
        for a, b, n in v["kenarlar"]:
            self.assertIn(a, idler); self.assertIn(b, idler); self.assertGreater(n, 0); self.assertNotEqual(a, b)
        alanlar = {a[0] for a in v["alanlar"]}
        for d in v["dugumler"]:
            self.assertEqual(len(d["konum"]), 3)
            self.assertIn(d["alan"], alanlar)
            self.assertLessEqual(d["dogum"], v["istatistik"]["bugun"])
            self.assertGreaterEqual(d["dogum"], v["istatistik"]["baslangic"])


class OrnekKlasorler(Temel):
    def test_duz_not_klasoru(self):
        v, ham = self.uret(os.path.join(KOK, "ornek", "notlar"))
        self.assertEqual(v["tur"], "notlar")
        self.assertEqual(v["istatistik"]["noron"], 28)
        self.assertGreater(len(v["kenarlar"]), 50)
        self.assertEqual(len(v["gorevler"]), 8)
        self.assertEqual({d["katman"] for d in v["dugumler"]}, {"cekirdek", "canli", "arsiv"})
        self.tutarli(v)

    def test_v4_kasasi(self):
        v, _ = self.uret(os.path.join(KOK, "ornek", "kasa"))
        self.assertEqual(v["tur"], "kasa")
        i = v["istatistik"]
        self.assertEqual(i["noron"], 24)
        self.assertEqual(i["turler"], {"kural": 13, "ders": 8, "olgu": 3})
        n = {d["id"]: d for d in v["dugumler"] if d["katman"] == "noron"}
        self.assertTrue(n["fermente-kapak-sikilmaz"]["sert"], "⛔ başlıklı nöron sert kural")
        self.assertTrue(n["force-push-yasak"]["sert"])
        self.assertFalse(n["kompost-islak-koku"]["sert"])
        self.assertEqual(n["maya-tuzu-sonra"]["kaynak"], "eksi-maya")
        self.assertEqual(n["maya-tuzu-sonra"]["alan"], "mutfak", "nöron rengi kaynak sayfasının alanından")
        kenar = {tuple(k[:2]) for k in v["kenarlar"]}
        self.assertIn(("eksi-maya", "maya-tuzu-sonra"), kenar, "ayrinti= bağı sinaps olur")
        self.assertIn(("canli-veri-onay", "yedek-once-al"), kenar, "türlü bağ (onkosul=) sinaps olur")
        g = {x["no"]: x for x in v["gorevler"]}
        self.assertEqual(len(g), 7)
        self.assertEqual((g["1"]["durum"], g["1"]["oncelik"], g["1"]["sayfa"]), ("sende", True, "lizbon-plani"))
        self.assertEqual(g["3"]["durum"], "bende")
        self.assertEqual(g["6"]["durum"], "dista")
        self.assertEqual(g["7"]["durum"], "askida")
        self.assertTrue(v["bitenler"] and v["bitenler"][0]["metin"].startswith("18.11"))
        self.assertEqual([a[0] for a in v["alanlar"]][:3], ["cekirdek", "mutfak", "bahce"], "alan sırası index.md'den")
        self.tutarli(v)

    def test_konumlar_belirlenimci(self):
        a, _ = self.uret(os.path.join(KOK, "ornek", "kasa"))
        b, _ = self.uret(os.path.join(KOK, "ornek", "kasa"))
        self.assertEqual([d["konum"] for d in a["dugumler"]], [d["konum"] for d in b["dugumler"]])

    def test_sayfa_klasoru(self):
        sayfa = os.path.join(self.d, "sayfa")
        with contextlib.redirect_stdout(io.StringIO()):
            uret.uret(os.path.join(KOK, "ornek", "notlar"), self.cikti, sayfa=sayfa)
        self.assertEqual(sorted(os.listdir(sayfa)), ["beyin.css", "beyin.js", "index.html", "veri.js"])


class Maskeleme(Temel):
    def test_sir_kaliplari(self):
        k = os.path.join(self.d, "n")
        yaz(k, "a.md", "# A\n\nanahtar sk-ant-api03-AAAABBBBCCCCDDDD ve ghp_ABCDEFGHIJKLMNOPQRSTUV12\n"
                       "PASSWORD = \"cokgizli123\"\n`ali@ornek.com` / `parolam99`\n"
                       "postgres://ali:dbparola@sunucu/db\n"
                       "-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----\n"
                       "telefon 0532 111 22 33 · bilinen: zumrut-anahtar-77\n")
        yaz(k, "beyin.json", json.dumps({"gizle": [r"\b0?5\d{2} \d{3} \d{2} \d{2}\b", "[geçersiz("]}))
        yaz(self.d, "sirlar.txt", "# yorum satırı\nzumrut-anahtar-77\n")
        with contextlib.redirect_stdout(io.StringIO()):
            uret.uret(k, self.cikti, sirlar=os.path.join(self.d, "sirlar.txt"))
        _, ham = veri_oku(self.cikti)
        for sir in ("sk-ant-api03", "ghp_ABCDEF", "cokgizli123", "parolam99", "dbparola", "OPENSSH PRIVATE KEY-----\\nabc",
                    "0532 111 22 33", "zumrut-anahtar-77"):
            self.assertNotIn(sir, ham, sir)
        self.assertIn("ali@ornek.com", ham, "e-posta değil, yanındaki parola maskelenir")
        self.assertTrue(any("geçersiz" in u for u in uret.UYARILAR), "bozuk gizle kalıbı uyarıyla atlanır")


class KenarDurumlar(Temel):
    def test_bom_crlf_cp1254(self):
        k = os.path.join(self.d, "n")
        yaz(k, "bom.md", "﻿---\r\nalan: mutfak\r\nguncelleme: 2026-03-04\r\n---\r\n# Börek\r\n\r\n[[cp]]\r\n")
        yaz(k, "cp.md", "# Şiş kebap ığdır\n\n[[bom]]\n", kodlama="cp1254")
        v, _ = self.uret(k, bugun="2026-06-01")
        d = {x["id"]: x for x in v["dugumler"]}
        self.assertEqual(d["bom"]["alan"], "mutfak", "BOM'lu dosyada ön bilgi okunur")
        self.assertEqual(d["bom"]["guncelleme"], "2026-03-04")
        self.assertNotIn("\r", d["bom"]["metin"])
        self.assertEqual(d["cp"]["baslik"], "Şiş kebap ığdır", "cp1254 dosya Türkçe harfleriyle okunur")
        self.assertTrue(any("cp1254" in u for u in uret.UYARILAR))
        self.assertEqual(len(v["kenarlar"]), 1)

    def test_bozuk_karakter_kacisla_yazilir(self):
        k = os.path.join(self.d, "n")
        yaz(k, "a.md", "# A\n\nbozuk � karakter ve satır ayırıcı\n")
        v, ham = self.uret(k)
        self.assertNotIn("�", ham); self.assertNotIn(" ", ham)
        self.assertIn("\\ufffd", ham)
        self.assertIn("�", v["dugumler"][0]["metin"], "anlam korunur (JSON kaçışı)")

    def test_ayni_adli_iki_not(self):
        k = os.path.join(self.d, "n")
        yaz(k, "mutfak/notlar.md", "# Mutfak notları\n")
        yaz(k, "bahce/notlar.md", "# Bahçe notları\n")
        yaz(k, "giris.md", "# Giriş\n\n[[notlar]]\n")
        v, _ = self.uret(k)
        self.assertEqual(len({d["id"] for d in v["dugumler"]}), 3)
        self.tutarli(v)

    def test_bozuk_tarihler_cokertmez(self):
        k = os.path.join(self.d, "n")
        yaz(k, "a.md", "---\nguncelleme: 2026-09-31\ndogum: dün\n---\n# A\n\n31.02.2026 ve 2026-13-01 geçersiz, 4 Kas geçerli\n")
        yaz(k, "gorevler.json", json.dumps([{"baslik": "iş", "son": "2026-02-30"}, {"no": 9}, "çöp"]))
        v, _ = self.uret(k, bugun="2026-11-19")
        self.assertEqual(len(v["dugumler"]), 1)
        self.assertEqual(len(v["gorevler"]), 1)
        self.assertIsNone(v["gorevler"][0]["yas"])
        self.assertTrue(any("geçersiz tarih" in u for u in uret.UYARILAR))

    def test_gecersiz_renk_ve_gezegen(self):
        k = os.path.join(self.d, "n")
        yaz(k, "a.md", "---\nalan: x\n---\n# A\n")
        yaz(k, "beyin.json", json.dumps({"alanlar": [{"anahtar": "x", "ad": "<b>X</b>", "renk": "red\"><img src=x onerror=alert(1)>",
                                                       "gezegen": "kripton"}, {"ad": "anahtarsız"}]}))
        v, ham = self.uret(k)
        self.assertEqual(v["alanlar"][0][:2], ["x", "<b>X</b>"], "ad düz yazı olarak taşınır (sayfa kaçışlar)")
        self.assertNotIn("onerror", ham)
        self.assertNotIn("kripton", ham)
        self.assertEqual(len(v["alanlar"]), 1)

    def test_kod_blogundaki_baglanti_sayilmaz(self):
        k = os.path.join(self.d, "n")
        yaz(k, "a.md", "# A\n\n```\n[[b]]\n```\n~~~\n[[b]]\n~~~\n`[[b]]` satır içi\n")
        yaz(k, "b.md", "# B\n\n[[A]]\n")   # büyük/küçük harf farkı bağı koparmaz
        v, _ = self.uret(k)
        self.assertEqual([k[:2] for k in v["kenarlar"]], [["a", "b"]])
        self.assertEqual(v["kenarlar"][0][2], 1, "yalnız b→A bağı sayıldı")

    def test_on_bilgi_dosya_sonunda(self):
        k = os.path.join(self.d, "n")
        yaz(k, "a.md", "---\nalan: bahce\n---")
        v, _ = self.uret(k)
        self.assertEqual(v["dugumler"][0]["alan"], "bahce")

    def test_bos_klasor(self):
        os.makedirs(os.path.join(self.d, "bos"))
        with self.assertRaises(SystemExit):
            self.uret(os.path.join(self.d, "bos"))

    def test_kasada_cift_kimlik_ve_eksik_parcalar(self):
        k = os.path.join(self.d, "kasa")
        yaz(k, "kural/a.md", "---\nid: ayni\ntur: kural\n---\n# Bir\n")
        yaz(k, "ders/b.md", "---\nid: ayni\ntur: ders\n---\n# İki\n")
        v, _ = self.uret(k)   # wiki/, is/, gunluk/ yok: yine de üretir
        self.assertEqual(v["istatistik"]["noron"], 1)
        self.assertTrue(any("çift kimlik" in u for u in uret.UYARILAR))
        self.tutarli(v)


class BuyukKlasor(Temel):
    def test_2000_not_makul_surede(self):
        k = os.path.join(self.d, "buyuk")
        for i in range(2000):
            yaz(k, "n%04d.md" % i, "---\nalan: a%d\n---\n# Not %d\n\n[[n%04d]] [[n%04d]]\n" % (i % 7, i, (i * 7 + 1) % 2000, (i * 13 + 5) % 2000))
        t = time.time()
        v, _ = self.uret(k)
        sure = time.time() - t
        self.assertEqual(len(v["dugumler"]), 2000)
        self.assertLess(sure, 120, "2.000 not %.1f sn sürdü" % sure)
        print("\n    2.000 not: %.1f sn, %d sinaps" % (sure, len(v["kenarlar"])), file=sys.stderr)
        self.tutarli(v)


class SayfaKopyalari(unittest.TestCase):
    def test_demo_kopyasi_kaynakla_ayni(self):
        """docs/ (GitHub Pages demosu) canli/ ile aynı kodu taşımalı — yoksa demo eskir."""
        for f in uret.SAYFA_DOSYALARI:
            self.assertTrue(filecmp.cmp(os.path.join(KOK, "canli", f), os.path.join(KOK, "docs", f), shallow=False),
                            "docs/%s eskimiş: bash canli/demo-uret.sh" % f)

    def test_demo_verisi_yalniz_ornek(self):
        v, ham = veri_oku(os.path.join(KOK, "docs", "veri.js"))
        self.assertEqual(v["tur"], "kasa")
        self.assertNotIn("Users", ham); self.assertNotIn("/home/", ham)
        self.assertIn("kayıt henüz yok", ham, "demo gerçek ateşleme kaydını okumamalı")

    @unittest.skipUnless(shutil.which("node"), "node yok")
    def test_js_sozdizimi(self):
        r = subprocess.run(["node", "-e", "new Function(require('fs').readFileSync(process.argv[1],'utf8'))",
                            os.path.join(KOK, "canli", "beyin.js")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
