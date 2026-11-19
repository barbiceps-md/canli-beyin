# İkinci bilgisayarda anlam katmanı (Beyin v4, isteğe bağlı)

Köprü (`yerel/OKU.md`) tek başına çalışır: her istemde SSH ile sunucuya sorar (~1,4 sn).
Anlam katmanı kurulursa bu bilgisayar kasanın **salt okunur aynasını** tutar ve kancaya
SSH'siz, ~0,2 sn'de, üstelik mesajın **anlamına göre** cevap verir.

⚠️ Ayna kasadaki her metni (notlar, açık işler) bu bilgisayara getirir. Yalnız güvendiğin
bilgisayarda kur. Sır (parola, jeton, anahtar) zaten kasaya yazılmaz.

```
<çalışma klasörü>/araclar/beyin/
  venv/        Python 3.10+ + torch + sentence-transformers
  hf/          model (BAAI/bge-m3, ~2,3 GB)
  kasa/        sunucudaki kasanın SALT OKUNUR aynası (+ _tarihce/)
  kod/         beyin · beyin-anlam · esitle.py   (kaynak: bu depo, bin/ ve yerel/pc/araclar-beyin/)
  durum/       vektör önbelleği · beyin-anlam.log · beyin-ates.tsv · esitle.kilit
.claude/kancalar/
  yerel-ates.sh   istem kancası: önce 127.0.0.1:7341, cevap yoksa sunucu.sh ates
  yerel-servis.sh oturum başı: servis kapalıysa başlatır, açıksa aynayı hemen eşitletir
  kod-guncelle.sh kod kopyalarını sunucudaki depoyla karşılaştırır/günceller
```

## Nasıl çalışır
- **Tek yazma yeri sunucu.** Ayna 3 dk'da bir `esitle.py` ile çekilir (dosya listesi + tek tar
  akışı, rsync gerekmez). Aynada `beyin ekle` / `beyin yeni` reddedilir.
- **Servis** (`beyin-anlam`, `pythonw` ile penceresiz): sorgular işlemcide (bge-m3 ~90 ms);
  120+ parça eksikse toplu kodlama ayrı, kısa ömürlü bir süreçte ekran kartında (varsa).
- **Kanca** `KANCAJ <kanca JSON'u>` gönderir; servis `beyin` kodunu kendi içinde modül olarak
  çalıştırır (aynı çıktı, SSH yok). Cevap: kanca JSON'u · `YOK` · `HATA …` (→ sunucu yolu).
- Servis yoksa ya da çökerse her şey köprü yoluyla yürür; hafıza servise bağımlı değil.

## Kurulum
`kur.ps1 … -Anlam` klasörleri kurar ve kodu kopyalar. Sonra (PowerShell, `araclar\beyin` içinde):
```
python -m venv venv
venv\Scripts\python -m pip install torch          # NVIDIA kartı varsa: --index-url https://download.pytorch.org/whl/cu1xx
venv\Scripts\python -m pip install sentence-transformers numpy
$env:HF_HOME="$PWD\hf"; venv\Scripts\python -c "from huggingface_hub import snapshot_download as s; s('BAAI/bge-m3', allow_patterns=['*.json','*.txt','*.model','sentencepiece*','tokenizer*','pytorch_model.bin','1_Pooling/*','modules.json'])"
venv\Scripts\python kod\esitle.py                  # ilk ayna
Start-Process -WindowStyle Hidden venv\Scripts\pythonw.exe kod\beyin-anlam
```
İlk açılışta toplu dizin kurulur (ekran kartında ~1 dk, işlemcide daha uzun), sonra
`durum/beyin-anlam.log`'da "dizin: {...}" satırı görünür. Ekran kartı yoksa servisi
`BEYIN_ANLAM_TOPLU_CIHAZ=cpu` ile başlat.

Sunucuda kasa ev klasöründe `beyin` değilse `BEYIN_UZAK_KASA` (ve tarihçe için
`BEYIN_UZAK_TARIHCE`) ortam değişkenlerini ayarla (ev klasörüne göreli).

## Otomatik başlatma
`.claude/settings.json` SessionStart'ta `yerel-servis.sh`: Claude Code bu klasörde açılınca servis
kapalıysa penceresiz başlatılır (~2-3 sn), açıksa ayna hemen eşitlenir. Windows açılışına eklenmez.

## Kod güncelleme
Depoda `bin/beyin`, `bin/beyin-anlam`, `yerel/pc/…` değişince bu bilgisayardaki kopyalar
kendiliğinden DEĞİŞMEZ. `bash .claude/kancalar/kod-guncelle.sh` farklı dosyaları sunucudan çeker;
servis kodu değiştiyse servisi (yalnız beyin-anlam'ı koşan pythonw, PID'iyle) yeniden başlatır.
Oturum başı kancası `--denetle` ile bakar; fark varsa oturuma tek satır ⚠️ düşer.

## Eşik ayarı
Eşikler `beyin-anlam` → `AYARLAR`'da ve sistemin doğduğu kasada ölçüldü. Kendi kasan büyüyünce
(yüzlerce nöron) kendi ölçüm kümeni yazıp `test/anlam/kalibre3.py` ile yeniden ayarla
(`test/anlam/OKU.md`). Küçük kasada anlam yolu az nöron getirir; tetik yolu yine çalışır.

## Sorun giderme
- Kanca yavaşladıysa servis kapalıdır: `Get-CimInstance Win32_Process -Filter "Name='pythonw.exe'"`.
- Model/eşik değişince `durum/*.npz` yeniden kurulur.
- Ayna bozulursa `kasa/` silinip `kod\esitle.py` ile yeniden çekilir (yazma yeri değildir).
