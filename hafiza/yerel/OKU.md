# İkinci bilgisayar köprüsü (isteğe bağlı)

> Bu klasördeki yollar `hafiza/` klasörüne göredir (`bin/beyin` = `hafiza/bin/beyin`).
> Tek bilgisayarda Windows kullanıyorsan buna gerek yok: bkz. `hafiza/windows/OKU.md`.

Hafıza tek yerde durur: sunucuda. Başka bir bilgisayardan (Windows + Git Bash)
da Claude Code kullanıyorsan, o bilgisayardaki kancalar SSH ile sunucudaki
kancaları çağırır. Kopya yok, eşitleme yok, çakışma yok.

```
ikinci bilgisayar                         sunucu
.claude/kancalar/sunucu.sh oturum-basi ─→ yerel/sunucu/oturum-basi-yerel.sh
.claude/kancalar/sunucu.sh ates        ─→ kancalar/kanca-ates.sh
.claude/kancalar/oturum-sonu.sh        ─→ konuşma kaydını yükler + kancalar/kanca-oturum-sonu.sh
.claude/kancalar/beyin.sh <komut>      ─→ bin/beyin <komut>
```

## Kurulum

1. Sunucuda: depoyu klonla, `./kur.sh` çalıştır.
2. İkinci bilgisayarın SSH açık anahtarını sunucuda yetkilendir.
3. İkinci bilgisayarda depoyu klonla, PowerShell'de:

   ```powershell
   .\hafiza\yerel\kur.ps1 -Sunucu <adres> -Kullanici <kullanıcı> -UzakKok <sunucudaki depo>/hafiza
   ```

   Bu `~\calisma` klasörünü kurar (`-Alan` ile değiştir). Claude'u o klasörden aç.

Sunucuda kasa varsayılan yerde değilse `-UzakOrtam "BEYIN_KASA=/yol/kasa"` ver.

## Anlam katmanı (isteğe bağlı)

`kur.ps1 … -Anlam` ile bu bilgisayara yerel dil modeli servisi ve kasanın salt okunur
aynası kurulur; istem kancası önce ona sorar (~0,2 sn, SSH yok), cevap yoksa yukarıdaki
köprüye düşer. Ayrıntı: `pc/BEYIN-PC.md`.

## Bilinen sınırlar

- Her kanca bir SSH bağlantısı açar (~0,3–1 sn). Bağlantı yoksa oturum hafızasız
  açılır ve bunu açıkça söyler.
- `kur.ps1` bu genelleştirilmiş hâliyle sözdizimi denetiminden geçti ama uçtan
  uca yalnız köprü betikleri (bash) denendi; ilk kurulumda çıktıyı oku.
