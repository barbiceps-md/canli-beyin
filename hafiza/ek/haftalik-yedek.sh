#!/usr/bin/env bash
# Haftalık kasa yedeği → senin ÖZEL uzak deponun (GitHub, Gitea, kendi sunucun…).
#
# Neden ayrı bir betik: oturum sonu kancası kasayı her oturumda yerelde sürümler. O yerel
# geçmişte, sonradan maskelenmiş bir sır eski bir anlık görüntüde kalmış olabilir; geçmişi
# yeniden yazmak geri alınamaz. Bu yüzden yerel geçmiş İTİLMEZ: her hafta güncel ağacın
# TEMİZ anlık görüntüsü, uzaktaki önceki yedeğin üstüne tek commit olarak eklenir.
#
# Göndermeden önce sır taraması: genel kalıplar (API anahtarı, jeton, özel anahtar, parolalı
# bağlantı adresi) + isteğe bağlı bilinen sırlar listesi. Bir şey bulursa DURUR, göndermez.
#
# Kurulum (bir kez):
#   1) Özel bir depo aç (ör. GitHub'da "private").  ⛔ Herkese açık depo KULLANMA.
#   2) cd "$BEYIN_KASA" && git remote add yedek <özel-deponun-adresi>
#   3) Elle dene:  bash hafiza/ek/haftalik-yedek.sh
#   4) Zamanla — Linux: crontab (bkz. hafiza/cron/ornek-crontab) · Windows: hafiza/windows/OKU.md
#
# Ayarlar (ortam değişkeni):
#   BEYIN_KASA         kasa                         varsayılan ~/beyin
#   BEYIN_YEDEK_UZAK   kasadaki uzak deponun adı    varsayılan yedek
#   BEYIN_YEDEK_DAL    uzak dal                     varsayılan main
#   BEYIN_SIRLAR       bilinen sırlar listesi (satır başına bir dize; DEPOYA KOYMA)
#                                                   varsayılan ~/.beyin-sirlar.txt (yoksa atlanır)
#   BEYIN_YEDEK_LOG    günlük dosyası               varsayılan ~/.beyin-yedek.log
set -uo pipefail
KASA="${BEYIN_KASA:-$HOME/beyin}"
UZAK="${BEYIN_YEDEK_UZAK:-yedek}"
DAL="${BEYIN_YEDEK_DAL:-main}"
SIRLAR="${BEYIN_SIRLAR:-$HOME/.beyin-sirlar.txt}"
GUNLUK="${BEYIN_YEDEK_LOG:-$HOME/.beyin-yedek.log}"
yaz() { echo "$(date '+%F %T') $*" | tee -a "$GUNLUK"; }

cd "$KASA" 2>/dev/null || { yaz "HATA kasa yok: $KASA"; exit 1; }
git remote get-url "$UZAK" >/dev/null 2>&1 || { yaz "HATA kasada '$UZAK' adlı uzak depo yok (kurulum adım 2)"; exit 1; }
KIM=(-c user.name=beyin -c user.email=beyin@localhost)   # oturum sonu kancasıyla aynı kimlik
git add -A >/dev/null 2>&1
git diff --cached --quiet || git "${KIM[@]}" commit -q -m "otomatik: haftalık yedek öncesi anlık görüntü"

# 1) genel sır kalıpları
GENEL='gh[opsu]_[A-Za-z0-9]{20,}|(^|[^A-Za-z0-9])sk-(proj-|ant-)?[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|EAA[A-Za-z0-9]{40,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|mongodb(\+srv)?://[^ :@/]+:[^ @/]+@|https?://[^ :@/]+:[^ @/]{4,}@'
BULGU=$(git ls-files -z | xargs -0 grep -n -I -E "$GENEL" 2>/dev/null | cut -c1-160)
# 2) bilinen sırlar — liste yalnız desen olarak kullanılır, içeriği hiçbir yere basılmaz
if [ -s "$SIRLAR" ]; then
  B2=$(git ls-files -z | xargs -0 grep -l -I -F -f "$SIRLAR" 2>/dev/null)
  [ -n "$B2" ] && BULGU+=$'\n'"bilinen sır şu dosyalarda: $B2"
fi
if [ -n "${BULGU//[$'\n ']/}" ]; then
  yaz "DURDU — sır şüphesi, gönderilmedi:"; echo "$BULGU" | tee -a "$GUNLUK"; exit 2
fi

# 3) temiz anlık görüntüyü uzaktaki yedeğin üstüne ekle
AGAC=$(git rev-parse 'HEAD^{tree}')
UST=""
if git fetch -q "$UZAK" "$DAL" 2>/dev/null; then UST=$(git rev-parse FETCH_HEAD); fi
if [ -n "$UST" ] && [ "$(git rev-parse "$UST^{tree}")" = "$AGAC" ]; then yaz "değişiklik yok, gönderim gerekmedi"; exit 0; fi
YENI=$(git "${KIM[@]}" commit-tree "$AGAC" ${UST:+-p "$UST"} -m "haftalık yedek $(date +%F)")
if git push -q "$UZAK" "$YENI:refs/heads/$DAL"; then
  yaz "OK yedek gönderildi ($(git ls-files | wc -l) dosya, ${YENI:0:7})"
else
  yaz "HATA gönderim başarısız"; exit 3
fi
