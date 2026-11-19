# Yerel çalışma klasörü (ikinci bilgisayar)

Bu klasör sunucudan ayrı bir bilgisayardaki çalışma alanı. **Sunucunun kural
dosyası oturum başında kancayla otomatik yüklenir ve burada da geçerlidir** —
aşağısı yalnız yerele özgü eklemeler. (Bu dosyayı kendine göre düzenle.)

## Hafıza ortak ve sunucuda (yazma) · bu bilgisayarda anlam katmanı (okuma, isteğe bağlı)
- Tek yazma yeri sunucudaki kasa. Yazmak (ekle/yeni) daima SSH ile:
  `bash .claude/kancalar/beyin.sh ekle|yeni|ara|is|yol|not …`; nöron dosyası düzeltmesi
  de SSH ile sunucuda yapılır.
- (Anlam katmanı kuruluysa) `araclar/beyin/kasa/` kasanın SALT OKUNUR aynasıdır (3 dk'da bir
  eşitlenir) — orada dosya düzenleme, bir sonraki eşitlemede ezilir. Servis kapalıyken ayna
  bayat kalır; Claude Code açılınca hemen eşitlenir.
- Bu bilgisayardaki hafıza kodu (`araclar/beyin/kod`, `.claude/kancalar`) sunucudaki depodan
  elle güncellenir: `bash .claude/kancalar/kod-guncelle.sh`. Fark varsa oturum başında ⚠️ çıkar.
- Hafıza servisi `araclar/beyin` (127.0.0.1:7341, model BAAI/bge-m3): istem kancası önce ona
  sorar (~0,2 sn); yoksa sunucu yoluna düşer (~1,4 sn). Kancadaki işaretler: `⚡/───` uy ·
  `🧭` yalnız başlık, işe dokunuyorsa `beyin.sh not <id>` · `📓` geçmişten ilgili kayıt.
- Önemli karar/iş bitince `beyin.sh ekle "<not>"` — sunucudaki oturumlar da görür.
- Konuşma kaydı her yanıttan sonra (Stop kancası, arka planda) sunucuya yüklenir.
- Kanca "SUNUCUYA BAĞLANILAMADI" dediyse oturum başı hafıza yok demektir; kullanıcıya söyle.

## Nerede ne yapılır
- (Kendi kurallarını yaz: kod nerede durur, canlıya nasıl çıkılır, bu
  bilgisayara neyin kopyalanmaması gerekir.)
