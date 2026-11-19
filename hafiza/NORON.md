# Nöron Sözleşmesi — Beyin v4

Bu dosya kasanın (veri klasörü, varsayılan `~/beyin`) kökünde durur ve hafızaya
nasıl yazılacağını belirler. `beyin saglik` bu sözleşmeyi denetler.

## Klasörler

| Yer | Ne | Kim yükler |
|---|---|---|
| `CLAUDE.md` (kasa DIŞINDA) | TEK kural dosyası (rol, sınırlar, hafıza kullanımı) | Claude Code kendisi |
| `konu.tsv` | konu → kaynak sayfa dizini; nöron tutmazsa işaret bırakır | ateşlemeyle |
| `kural/` | değişmeyen karar/kural | ateşlemeyle veya `beyin ara` |
| `ders/` | tuzak, bir kez yanıldığımız şey | **ateşlemeyle** (tetik etiketi) |
| `is/acik.md` | açık işlerin TEK listesi — satır ≤160 karakter | `beyin giris` |
| `is/ayrinti.md` | açık işlerin hikâyesi/ayrıntısı — `### <no>` bölümleri | `beyin is <no>` |
| `gunluk/YYYY-AA-GG.md` | oturum notları, **sadece ekle** | son 72 saati `beyin giris` özetler; gerisi aranır |
| `wiki/` `arsiv/` | uzun kaynak sayfalar, eski notlar | yalnız `beyin ara` |
| `durum-ek.sh` | işe özgü ölçümler (isteğe bağlı) | `durum` |
| `.gitignore` | **beyaz liste**: yalnız yukarıdaki klasörler sürümlenir; yeni üst klasör açılacaksa önce buraya eklenir | oturum sonu kancası |

**Durum bir nöron DEĞİLDİR.** "Kaç kayıt var", "yedek koştu mu", "ne bekliyor"
elle yazılmaz — `durum` komutu ölçer. Yazılan sayı bayatlar, ölçülen bayatlamaz.

## Çalışma arşivi — saklanır ama YÜKLENMEZ

Nöronlar *kuralı* tutar, hikâyeyi değil. Hikâye üç katmanda ayrıca saklanır ve
hiçbiri oturum başında yüklenmez — yalnız arandığında gelir:

| Katman | Nerede | Ne zaman yazılır |
|---|---|---|
| Günün çalışma hikâyesi | `gunluk/<tarih>-ozet.md` | her gece |
| Aylık proje tarihçesi | `<arşiv>/proje-tarihcesi/<ay>.md` | ayın 2'si |
| Ham oturum transkripti | `<arşiv>/oturum-kayitlari/` (şifreli) | 45 gün sonra, aylık |

Böylece "bu neden böyle yapılmış?" sorusunun cevabı kaybolmaz ama her oturuma
maliyet çıkarmaz.

## Nöron biçimi (zorunlu)

```markdown
---
id: canli-veri-onay
tur: kural                      # kural | ders | olgu
guncelleme: 2026-01-15
gecerlilik: kalici              # kalici  VEYA  son kullanma tarihi: 2026-09-30
tetik: veritabanı, kayıt sil, drop table      # bu sözler geçince nöron ateşlenir
bag: onkosul=yedek-once-al
---
# Tek cümlelik başlık — kuralın kendisi

Gövde: en fazla ~20 satır. Doğrusu ne, yanlışı ne.

**Neden:** tek cümle.
**Kanıt:** tarih + ne oldu.
```

## Kurallar

1. **Bir nöron = bir olgu.** Ölçü **gövdenin dolu satırı**: en çok **24**
   (ön bilgi ve boş satırlar sayılmaz — tetik yazmak cezalandırılmasın diye).
   Aşan nöron bölünür; `beyin saglik` uyarır. İki olgu bir dosyada duruyorsa
   satır sayısı sınırın altında olsa bile ayrılır: ateşleme tetiği daralır.
2. **`tetik` şart** (`ders` ve `kural` için): hangi sözler/dosya adları geçince
   bu nöron hatırlanmalı. Ateşleme aramanın yerine geçer. Tetik kelime başında
   eşleşir, sonuna ek alabilir (`fiyat` → `fiyatını`); BÜYÜK HARFLİ kısa tetik
   (≤5 harf) tam kelime ister.
3. **`bag` türlüdür** — düz `[[x]]` değil, ilişki adı taşır:
   `gerekce=` · `kaniti=` · `onkosul=` · `celisir=` · `yerine-gecti=` ·
   `birlikte=` · `ayrinti=` (ayrıntı `wiki/` sayfasına işaret edebilir).
   `yerine-gecti=` görülürse eski nöron **açılmaz**, geçersizdir.
4. **`gecerlilik` şart.** Kalıcı olmayan her şeye son kullanma tarihi konur.
   Tarihi geçen nöron `beyin saglik`'te "bayat" görünür ve yenilenir ya da silinir.
5. **Başlık kuralın kendisidir.** Başlığında "asla / yasak / önce onay" geçen
   nöron *sert kural* sayılır ve ateşlemede puan eşiğinden muaftır — bu yüzden
   bu sözleri yalnız gerçekten öyle olan kuralların başlığına yaz.
6. **Silmekten korkma.** Yanlış/eskiyen nöron `arsiv/noron-bakim-<tarih>/`'e taşınır
   (ateşlenmez, `beyin ara` bulur); kopya nöron birine katılıp öteki arşive gider.
   `tur:` yalnız `kural | ders | olgu | arsiv` — "tuzak" türü yok, tuzak = `ders`.
7. **Sır yazılmaz.** Parola, jeton, anahtar hiçbir nörona girmez.
8. **Çakışma yok:** oturumlar `gunluk/` dosyasına **ekler**, aynı satırı düzenlemez.

## Bakım

Ayda bir ya da `beyin saglik` kırmızıya döndükçe: `saglik` yeşil · açık işte
30+ gün hareketsiz, başkasını bekleyen satır `is/kucuk.md`'ye iner (silinmez) ·
tetik daraltılınca `test/isabet/olc.py` tüm kümelerde **recall %100** kalmalı
(güvenlik kuralının tetiği daraltılmaz, ancak genişler).

## Anlam katmanı (v4) — kancanın getirdiğini okuma

Kullanıcı günlük dille yazar; tetik sözü birebir geçmeyince kural gelmiyordu (ölçüm:
doğal cümlede %29, dolaylı iş isteğinde %1). İsteğe bağlı olarak yerel bir dil modeli
mesajı **anlamına göre** de karşılaştırır (`bin/beyin-anlam`, model BAAI/bge-m3; veri
makineden çıkmaz). Kancanın çıktısında dört işaret var:

| İşaret | Ne | Ne yapılır |
|---|---|---|
| `⚡ … ateşlendi` + `───` gövde | emin olunan nöron (≤3) ve tetikle gelen SERT kural | **uy** |
| `🧭 Belki ilgili` | sıradaki adaylar, yalnız başlık (başlık = kuralın kendisi) | işe dokunuyorsa `beyin not <id>` ile aç |
| `📓 ilgili kayıtlar` | geçmişten günlük notu / gece özeti / açık iş satırı | ayrıntı için `beyin ara` / `beyin is <no>` |
| `📎 konunun kaynağı` | konu.tsv'deki kaynak sayfa | gerekirse `beyin not <yol>` |

**Servis yoksa** her şey eski tetik yoluyla yürür — hafıza servise bağımlı değil.
Kurulum ve iki bilgisayarlı düzen (sunucuda kasa, PC'de salt okunur ayna + servis):
`hafiza/yerel/pc/BEYIN-PC.md`. ⛔ **Tek yazma yeri kasanın asıl kopyası**: aynada (`BEYIN_AYNA=1`)
`beyin ekle` ve `beyin yeni` reddedilir; aynadaki nöron dosyası da düzenlenmez — bir
sonraki eşitleme ezer.

**Tetik yine önemli:** sert kurallar ve teknik tuzaklar (komut/tablo adı) tetikle gelir;
anlam katmanı tetiği tutmayan günlük dili yakalar. Yeni nöronun başlığını **kuralın
kendisi** olarak yaz — 🧭 satırında yalnız başlık görünür.

**Ateşleme kaydı:** `$BEYIN_ARSIV/beyin-ates.tsv` (değiştirmek için `BEYIN_ATES_KAYIT`) —
tarih · yol · basılan · anılan. İstem metni yazılmaz. Bakımda "hiç ateşlenmeyen" nöron
buradan bulunur; `durum` son 7 günün özetini basar.

## Araçlar

```
beyin giris          oturuma başla: TAZE durum + son 72 saat (günlükten) + kısa açık işler
beyin son72          son 72 saatin günlük notları (canlı özet, hiçbir yere yazılmaz)
beyin is <no>        açık işin kısa satırı + ayrıntısı (is/ayrinti.md)
beyin ates <metin>   bağlama uyan nöronları ateşle (dosya yolu verilirse İÇERİĞİ okunur)
beyin yol <id>       nöronu + bir sıçramalık komşularını bas
beyin ara <kelime>   her yerde ara (gunluk/ ve is/ dahil) — dosya değil BÖLÜM döndürür;
                     Türkçe-duyarsız; SIRALI ve TAVANLI (12 bölüm / 10 KB), `--tum` hepsi
beyin ekle <not>     oturum notunu gunluk/<tarih>.md'ye EKLE (çakışmasız tek yazma yolu)
beyin not <id>       nöronu/dosyayı tam bas
beyin geri <id>      bu nörona kim bağlanıyor (backlink)
beyin liste [tur]    nöron kataloğu (⚠️ bayat, ⛔ geçersiz işaretli)
beyin son            son değişen dosyalar
beyin saglik         doğrulayıcı: boyut, şema, tetik, kırık bağ, bayat, yetim, çift id,
                     açık iş satırı (≤160, ✅ kalmış mı), konu.tsv hedefleri
beyin yeni <id>      boş nöron şablonu bas
durum                ölçülen güncel durum (hiçbir yere yazılmaz)
beyin-anlam          anlam katmanı servisi (isteğe bağlı; Windows'ta 127.0.0.1:7341, Linux'ta Unix soketi)
esitle.py            PC: kasanın salt okunur aynasını sunucudan eşitle (servis 3 dk'da bir koşar)
kod-guncelle.sh      PC: kod kopyalarını sunucudaki depoyla karşılaştır/güncelle (`--denetle` yalnız bakar)
```

Nöron tutmazsa `konu.tsv` eşleşmesi tek satırlık "📎 konunun kaynağı" işareti
bırakır (gövde yüklemez). Açık iş listesine sayı/tutar/telefon/hikâye yazılmaz;
`is/ayrinti.md`'ye gider. Günlük notu (`beyin ekle`) ertesi oturumlarda "son 72
saat" özetinde görünür — hikâyenin yeri orasıdır, açık iş listesi değil.

Ateşleme güvenceleri: `yerine-gecti` taşıyan nöron gövdesiz "⛔ GEÇERSİZ" olarak
gelir; geçerliliği dolmuş nöron "⚠️ BAYAT" uyarısıyla gelir; tek istekte en çok
6 nöron basılır (fazlası adlarıyla listelenir); tek nöron gövdesi en çok 40 satır.
