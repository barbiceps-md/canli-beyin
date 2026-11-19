# Örnekler — hepsi UYDURMA

Buradaki kişiler, olaylar, tarihler ve notlar gerçek değildir; yalnız sistemi denemek için yazıldı.

| Klasör | Ne | Nasıl denenir |
|---|---|---|
| `kasa/` | Beyin v4 hafıza kasası: 24 nöron (13 kural, 8 ders, 3 olgu), 20 konu sayfası, arşiv, 3 günlük, 7 açık iş | `./kur.sh --ornek` kasaya kopyalar · `python canli/uret.py ornek/kasa --sayfa /tmp/cb` |
| `notlar/` | hafızasız, düz Markdown not klasörü (Obsidian tarzı `[[bağlantı]]`) | `python canli/uret.py ornek/notlar --sayfa /tmp/cb` |
| `CLAUDE-ornek.md` | kendi `CLAUDE.md`'ne eklenecek hafıza bölümü | kopyala, `<kasa>` yerine yolunu yaz |
| `durum-ek.sh` | `durum` komutuna işine özgü ölçüm ekleme örneği | `<kasa>/durum-ek.sh` olarak kopyala |

`kasa/` aynı zamanda test kum havuzudur: `test/hafiza-testleri.sh` her koşuda onun bir kopyasını kurar; ateşleme
isabet kümesi (`test/isabet/kume.tsv`) bu nöronlarla %100 isabet ve %100 recall bekler. Yeni örnek nöron
eklersen tetiğinin o kümedeki cümlelerle çakışmadığına bak (ör. kısa tetik `NAS` büyük harfle yazılır ki
"nasılsın"da ateşlenmesin).
