# Sürüm geçmişi

## 1.0 — birleşik proje (Canlı Beyin + Beyin v4)

Hafıza çekirdeği ile Canlı Beyin görselleştirmesi tek depoda, tek kurulumla.

**Yapı**
- `hafiza/` hafıza çekirdeği (Beyin v4.1 + anlam "yalnız ekler" düzeltmesi), `canli/` görünüm, `ornek/kasa/` uydurma
  örnek kasa, `docs/` GitHub Pages demosu, `test/` iki takım. Tek kurulum: `kur.sh` (Linux/macOS/WSL/Git Bash).
- Anlam katmanı artık yalnız **ekler**: tetik yolunun seçtiği nöron anlamca düşük skor aldı diye düşmez (ölçümde
  doğrudan mesajlarda tetikle gelen 7 kuraldan 5'i 4'e iniyordu); belirgin anlam isabeti üstüne eklenir.

**Windows (Git Bash) katmanı**
- `hafiza/windows/kanca.sh`: çekirdek kancaları değiştirmeden çağıran sarmalayıcı (gerçek Python, UTF-8 konsol,
  anlam servisi yalnız açıkken). `kur.sh` Windows'u tanır: `python3` ara katmanı, komut sarmalayıcıları, kancalar
  `bash.exe` + argümanla.
- Dosya kilidi `fcntl` yerine Windows'ta `msvcrt`; `durum` bash ile koşar; isabet ölçümü Python ile.
- `hafiza/ek/zaman.py` (oturum başında şu an + son oturumlar), `islenmemis.py`, sır taramalı `haftalik-yedek.sh`.

**Canlı Beyin v4 görünümü**
- Kasayı doğrudan okur: nöronlar (kural/ders/olgu) kaynak sayfalarının çevresinde kürecik / yörüngede asteroit kuşağı;
  sert kural kırmızıya, olgu soluk; açık işler `is/acik.md` + `is/ayrinti.md`'den; son bitenler günlükten.
- Düz Markdown klasörünü de okumaya devam eder (iki kip kendiliğinden seçilir). Sinapslar toplu çizilir.

**Denetim düzeltmeleri**
- Veriden gelen renk HTML'e kaçışsız giriyordu (`renk` alanıyla betik çalıştırılabilirdi) → doğrulanıyor, DOM ile.
- Üretici büyük klasörde O(n²) idi (2.000 notta dakikalar) → ızgaralı itme.
- UTF-8 olmayan dosya üreticiyi çökertiyordu → cp1254 denenir, uyarılır; BOM'lu ön bilgi okunur.
- Bozuk karakter (U+FFFD) metinde "U+FFFD" yazısına dönüşüyordu → JSON kaçışıyla yazılır, anlam korunur.
- Aynı adlı iki not birbirini sessizce eziyordu → ikincisi yoluyla adlanır, uyarılır.
- Takvimde olmayan tarih (`2026-09-31`) üreticiyi çökertiyordu → atlanır, uyarılır.
- Düz not klasöründe zaman cetveli "0 nöron · 30 sayfa" diyordu; "7 gün önce"den eskisi tarihle yazılır.
- Erişilebilirlik: `lang="tr"`, başlık `<head>`'de, katmanlar `role="dialog"` + odak yönetimi, klavyeyle gezinme
  (oklar, `+`/`−`, `/`, `Esc`), küçük yazı kontrastı WCAG AA'ya çekildi, arama kutusu taşması düzeldi.
- Geniş ekranda ayrıntı sayfası sağda kart; yatay ekranda beyin daha büyük çizilir.
- Bağlantıyla açılış: `?gorunum=yorunge|noral`, `?ac=<kimlik>`.
- Ekran görüntüleri yenilendi (eskileri v4 öncesi görünümdendi), dönen beyin GIF'i eklendi.

**Testler**: çekirdek takımı örnek kasada koşar (Windows'ta da), üreticiye 19 test eklendi.

---

## Hafıza çekirdeği (Beyin) — önceki sürümler

## Paylaşım sürümü
Sistemin kişiye/işletmeye özgü her şeyden arındırılmış hâli. Yollar ortam
değişkeniyle ayarlanır, `durum` genel ölçümlere indirildi (işe özgü ölçüm
`<kasa>/durum-ek.sh`'ye taşındı), testler kendi kum havuzunu kurar.

## v4.1
- Ayna koruması `ekle`'den `yeni`'ye de genişledi; aynada (`BEYIN_AYNA=1`) ikisi de çıkış 1
  ile reddedilir. Nöron düzeltmesi kasanın asıl kopyasında yapılır.
- PC Stop kancası: ateşleme kaydı her çağrıda kendi dosyasına taşınır; paralel oturumlar
  birbirinin partisini silmez/çift göndermez, yarım kalan parti 10 dk sonra geri katılır.
- PC kopyası kayması: `yerel/pc/.claude/kancalar/kod-guncelle.sh` (`--denetle` yalnız bakar);
  oturum başı kancası `yerel-servis.sh` fark görürse tek satır ⚠️ basar.
- `.gitattributes`: her metin dosyası LF (Windows klonu CRLF yapıyordu).

## v4.0 — anlam katmanı
Ölçüm düzeneği: kullanıcının ağzından yazılmış ~850 cümle (her nöron için bir doğal, bir
dolaylı iş isteği; yarısı AYAR, yarısı dokunulmamış SINAV), 50 sohbet mesajı, güvenlik
kümeleri, 40 geçmiş sorusu.
- **Anlam katmanı** (`bin/beyin-anlam`): yerel, çok dilli dil modeli (BAAI/bge-m3); hiçbir
  metin dışarı gitmez. İsteğe bağlı; ikinci bilgisayarda kasanın **salt okunur aynası**
  üzerinde çalışabilir (`yerel/pc/araclar-beyin/esitle.py`, 3 dk'da bir). Sorgular
  işlemcide (~90 ms), toplu dizinleme kısa ömürlü bir süreçte ekran kartında.
- **İki kademeli ateşleme:** emin olunan ≤3 nöron gövdeyle; sıradaki ≤5 aday 🧭 yalnız
  başlıkla; sert kural tetikle her zaman gövdeyle; 📓 geçmişten ilgili günlük / gece
  özeti / açık iş satırı. SINAV kümesinde: doğal cümlede hedef kural %28,9 → gövdeyle
  %50,5, gövde ya da başlıkla %78,9 · dolaylı iş isteğinde %1,0 → %31,4 · güvenlik
  recall %100 korundu. Mesaj başına bağlam ~1,0 → ~1,7 KB.
- **PC kancası SSH'siz:** istem başına ~1,4 sn → ~0,15-0,2 sn. Servis yoksa sunucu yoluna düşer.
- **Tetik eşleştirme 2,4 kat hızlı** (ön eleme + kalıp önbelleği); servis yokken çıktı
  v3 ile birebir aynı.
- **son72:** not başındaki tarih/saat tekrarı atılır, oturum kapanış notları öne alınır.
- **Ateşleme kaydı** (`beyin-ates.tsv`): hangi nöron ne zaman geldi. İstem metni YAZILMAZ.
- Uzun istemde (>1.500 karakter: yapıştırılmış rapor, alt ajan dönüşü) gövde tavanı 2.
- `beyin ara`: çok kelimeli soruda ya da birebir sonuç azsa anlamca da arar (servis varsa).
- Test takımı kum havuzunu ortam değişkeniyle yalıtır; yeni testler eklendi.

## v3.0
- Giriş nöronu kaldırıldı; kurallar TEK dosyada (`CLAUDE.md`).
- Oturum başına **son 72 saat** (günlük notlarından canlı özet, ≤5,5 KB). Sebep:
  günde 10+ oturum açılıyor, hiçbiri öncekini görmüyordu; hikâye açık iş
  listesine sızmıştı.
- `is/acik.md` satırı ≤160 karakter; ayrıntı `is/ayrinti.md`'de. `beyin is <no>`
  ayrıntıyı getirir; `saglik` uzun/kapanmış satırı kırmızı gösterir.
- `beyin ara` sıralı + tavanlı (12 bölüm / 10 KB / bölüm 3 KB; `--tum`).
- `konu.tsv`: nöron tutmayınca "📎 konunun kaynağı" işareti.
- Tetik ağırlığı (IDF), ünsüz yumuşaması, kısaltma tuzağı, sert kural muafiyeti.
- Oturum sonu kancası: bayat git kilidi, toplu yabancı dosya koruması, push.

## v2.2
- Çalışma arşivi 3 katman: gecelik iş günlüğü, aylık proje tarihçesi, şifreli
  ham transkript arşivi. Transkriptlerin 30 günde otomatik silinmesi durduruldu.

## v2.1
Bağımsız bir denetimin doğrulanmış bulguları kapatıldı:
- `ates` bayat/`yerine-gecti` nöronları uyarısız basıyordu
- `ara` Türkçe harfe kördü (`fotograf` ≠ `fotoğraf`)
- takvimde olmayan tarih (2026-09-31) 5 komutu birden çökertiyordu
- çift id sessizce gölgeleniyordu, denetimi ölü koddu
- backlink araması `grep` deseni yüzünden hiç çalışmıyordu
- `gunluk/` ve `is/` aranmıyordu; bölüm başlıkları aranmıyordu
- dosya yolu verilince içeriği okunmuyordu
- `ekle` ilk-yazar yarışında başlığı çoğaltıyordu
Her bulgu regresyon takımında bir teste dönüştü.

## v2.0
İlk sürüm: atomik nöron ağı, ateşleme, ölçülen durum, üç kanca.
