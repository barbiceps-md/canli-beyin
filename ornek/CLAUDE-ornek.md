# CLAUDE.md'ye eklenecek hafıza bölümü (örnek)

Aşağıdaki bölümü kendi `CLAUDE.md` dosyana kopyala ve `<kasa>` yerine kasanın
yolunu yaz (varsayılan `~/beyin`). Kurallarının TEK yeri CLAUDE.md olsun;
aynı kuralı hem orada hem bir nöronda tutma.

---

## Hafıza: `<kasa>` (nöron ağı) — sözleşme `<kasa>/NORON.md`

Oturum başında kanca otomatik yükler: ölçülen **DURUM** + **son 72 saat** +
**açık iş listesi**. Bağlamda "DURUM —" bloğu yoksa kanca çalışmamış demektir,
`beyin giris` komutunu kendin koş. Kural/tuzak nöronları istemindeki sözlerle
kendiliğinden ateşlenir ("⚡ Hafızadan…" bloğu) — gelen nörona uy.

- Bir şeyi hatırlaman gerekiyorsa önce ara: `beyin ara <kelime>`.
- Önemli karar ya da iş bitince not düş: `beyin ekle "<ne oldu, neden>"`.
  Sonraki oturumlar bunu "son 72 saat"te görür.
- Kalıcı bir kural ya da tuzak çıktıysa nöron aç: `beyin yeni <id>` şablonu
  basar; `<kasa>/kural/` ya da `<kasa>/ders/` altına yaz, `beyin saglik` koş.
- Açık iş listesi `is/acik.md` tektir; satır ≤160 karakter, ayrıntı
  `is/ayrinti.md`'de. Biten satırı SİL.
- Durumu (sayı, "koştu mu", "ne bekliyor") hafızaya YAZMA — `durum` ölçer.
- Sır (parola, jeton, anahtar) hiçbir nörona, nota, günlüğe girmez.
