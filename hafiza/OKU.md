# Hafıza çekirdeği — başvuru

Genel tanıtım ve kurulum kök dizindeki `README.md`'de. Bu sayfa çekirdeğin ayarları ve iç düzeni içindir;
yollar bu klasöre (`hafiza/`) göredir. Nöron biçimi ve kurallar: [`NORON.md`](NORON.md).

Hafıza çekirdeğinin yazarı: Ceyhun Yaprak.

## Mimari

```
~/beyin/                  KASA — veri (bu depoda değil, senin)
├── NORON.md              sözleşme
├── konu.tsv              konu → kaynak sayfa dizini
├── kural/                değişmeyen kararlar (atomik)
├── ders/                 tuzaklar — tetikle ateşlenir
├── is/acik.md            tek açık iş listesi
├── gunluk/               oturum notları + gecelik anlatı
├── wiki/ arsiv/          uzun kaynak sayfalar: yalnız aranır
└── durum-ek.sh           işine özgü ölçümler (isteğe bağlı)

bin/beyin                 sorgu aracı (giris·son72·ates·yol·ara·is·ekle·saglik…)
bin/durum                 ölçülen durum — hiçbir yere yazmaz
bin/beyin-anlam           anlam katmanı servisi (isteğe bağlı, yerel dil modeli)
bin/oturum-ozut.py        ham transkriptten öz çıkarır (sırları maskeler)
kancalar/                 SessionStart · UserPromptSubmit · Stop
arsivleme/                gecelik iş günlüğü · aylık tarihçe · şifreli arşiv
yerel/                    ikinci bilgisayardan (Windows) aynı hafızaya SSH köprüsü
windows/                  tek bilgisayarda Windows (Git Bash) kanca sarmalayıcısı
ek/                       zaman.py · islenmemis.py · haftalik-yedek.sh
../ornek/                 örnek kasa, CLAUDE.md bölümü, durum-ek örneği
../test/hafiza-testleri.sh  regresyon takımı (kum havuzunda koşar)
../test/anlam/            anlam katmanı ölçüm ve eşik ayarı betikleri
```


### Üç kanca

| Olay | Ne yapar |
|---|---|
| `SessionStart` | ölçülen durum + son 72 saatin notları + açık iş listesini yükler |
| `UserPromptSubmit` | cümleye uyan nöronları ateşler (eşleşme yoksa hiçbir şey eklemez) |
| `Stop` | kasayı git'e sürümler, uzak depo varsa push eder, sağlığı denetler |

### Ayarlar (ortam değişkenleri)

| Değişken | Varsayılan | Ne |
|---|---|---|
| `BEYIN_KASA` | `~/beyin` | veri klasörü |
| `BEYIN_ARSIV` | `~/beyin-arsiv` | tarihçe, şifreli arşiv, loglar |
| `BEYIN_UTC_FARK` | `3` | yerel saat farkı (Türkiye) |
| `BEYIN_KULLANICI` | `kullanıcı` | gece günlüğünde anılacak ad |
| `BEYIN_PROJE` | `Proje` | aylık tarihçenin başlığı |
| `BEYIN_DEPOLAR` | — | tarihçeye girecek git depoları (boşlukla) |
| `BEYIN_MODEL` | — | gece işlerinde `claude --model` |
| `BEYIN_ATES_KAYIT` | `<arşiv>/beyin-ates.tsv` | ateşleme kaydı (istem metni yazılmaz) |
| `BEYIN_ANLAM` | `1` | `0` → anlam servisine hiç sorma |
| `BEYIN_ANLAM_ADRES` | Linux: `unix:/run/beyin-anlam/soket` · Windows: `tcp:127.0.0.1:7341` | servis adresi |
| `BEYIN_AYNA` | — | `1` → bu kasa salt okunur ayna, yazma komutları reddedilir |
| `BEYIN_BIN` | `~/.local/bin` | `kur.sh`'in komutları (ve Windows'ta `python3` ara katmanını) koyduğu yer |
| `BEYIN_OTURUM_KOK` | `~/.claude/projects` | Claude Code oturum kayıtları (öz çıkarıcı, `ek/zaman.py`) |
| `BEYIN_ANLAM_KOK` | `~/beyin-anlam` | Windows: anlam servisi klasörü; `durum/acik` varsa servise sorulur |
| `BEYIN_ZAMAN` | `1` | Windows kancası: `0` → oturum başında zaman/son oturumlar bloğu yok |
| `BEYIN_SIRLAR` | `~/.beyin-sirlar.txt` | bilinen sırlar listesi (yedek taraması, `beyin-canli` maskesi) — depoya KOYMA |
| `BEYIN_YEDEK_UZAK` | `yedek` | `ek/haftalik-yedek.sh`'in kasada kullandığı uzak depo adı |

## Çalışma arşivi (üç katman, hiçbiri yüklenmez)

| Katman | Nerede | Ne zaman |
|---|---|---|
| Günün çalışma hikâyesi | `<kasa>/gunluk/<tarih>-ozet.md` | her gece |
| Aylık proje tarihçesi | `<arşiv>/proje-tarihcesi/<ay>.md` | ayın 2'si |
| Ham oturum transkripti | `<arşiv>/oturum-kayitlari/` (AES-256) | ayın 3'ü, 45 gün sonra |

Gecelik anlatı ham transkriptten `claude -p` ile üretilir ve "ne istendi / ne
yapıldı / **neden böyle yapıldı** / öğrenilenler / açık kalanlar" başlıklarını
taşır. Amaç: bir kararın gerekçesinin aylar sonra bulunabilmesi. Cron satırları
`cron/ornek-crontab`'da; `kur.sh` senin yolunla basar.

## Anlam katmanı (v4, isteğe bağlı)

Tetik eşleşmesi kelimeye bakar; insanlar ise günlük dille yazar. Ölçümde tetik sözü
birebir geçmeyen doğal cümlede hedef kural %29, dolaylı iş isteğinde %1 geliyordu.
`bin/beyin-anlam` yerel, çok dilli bir dil modeliyle (BAAI/bge-m3) mesajı nöronlarla
**anlamına göre** de karşılaştırır; hiçbir metin makineden çıkmaz. Kanca artık iki
kademeli basar:

| İşaret | Ne |
|---|---|
| `⚡` + `───` gövde | emin olunan ≤3 nöron ve tetikle gelen SERT kural — uy |
| `🧭 Belki ilgili` | sıradaki ≤5 aday, yalnız başlık — gerekirse `beyin not <id>` |
| `📓` | geçmişten ilgili günlük notu / gece özeti / açık iş satırı |

Sistemin doğduğu kasada (430 nöron, dokunulmamış sınav kümesi): doğal cümlede hedef
kural %28,9 → gövdeyle %50,5, gövde ya da başlıkla %78,9; dolaylı istekte %1 → %31;
güvenlik kurallarında recall %100 korundu. Servis yoksa ya da kapalıysa her şey eski
tetik yoluyla, birebir aynı çıktıyla yürür. Kurulum: [`yerel/pc/BEYIN-PC.md`](yerel/pc/BEYIN-PC.md).

## İkinci bilgisayar (isteğe bağlı)

Hafıza bir sunucuda duruyorsa ve başka bir bilgisayardan (Windows) da Claude
Code kullanıyorsan `yerel/` klasörü köprü kurar: o bilgisayardaki kancalar SSH
ile sunucudaki kancaları çağırır. İstersen o bilgisayara anlam katmanını da
kurarsın: kasanın salt okunur aynası 3 dk'da bir eşitlenir, kanca SSH'siz ~0,2 sn'de
cevaplanır (tek yazma yeri yine sunucu). Bkz. `yerel/OKU.md`, `yerel/pc/BEYIN-PC.md`.

## Ateşleme isabetini ölçmek

`test/isabet/` altında küçük bir ölçüm aracı var: cümle → beklenen nöron
tablosu verirsin, isabet ve kaçırma oranını basar. Kendi kasan büyüdükçe kendi
kümeni yaz. Bkz. [`../test/isabet/OKU.md`](../test/isabet/OKU.md).
