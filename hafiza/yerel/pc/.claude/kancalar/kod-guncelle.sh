#!/usr/bin/env bash
# PC'deki hafıza kodunu sunucudaki depoyla (ayar.sh: UZAK_KOK) karşılaştırır / günceller.
# (Depo değişip PC'ye elle kopyalanmayınca PC sessizce eski kodu koşuyordu. Oturum başı
# kancası yerel-servis.sh bunu --denetle ile çağırır, fark varsa ⚠️ basar.)
#
#   bash .claude/kancalar/kod-guncelle.sh            farklı dosyaları sunucudan çek; servis kodu
#                                                    (beyin, beyin-anlam) değiştiyse servisi yeniden başlat
#   bash .claude/kancalar/kod-guncelle.sh --denetle  yalnız bak: farklı dosyaların yolunu yaz
#
# Çıkış: 0 = aynı / güncellendi · 1 = fark var (--denetle) ya da bir dosya alınamadı · 2 = sunucuya ulaşılamadı
KOK="$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)"        # çalışma klasörü
# shellcheck disable=SC1091
. "${BASH_SOURCE[0]%/*}/ayar.sh" 2>/dev/null || exit 2
DEPO="$UZAK_KOK"
# <PC'deki yol, KOK'a göre>|<depodaki yol>
ESLER="araclar/beyin/kod/beyin|bin/beyin
araclar/beyin/kod/beyin-anlam|bin/beyin-anlam
araclar/beyin/kod/esitle.py|yerel/pc/araclar-beyin/esitle.py
.claude/kancalar/beyin.sh|yerel/pc/.claude/kancalar/beyin.sh
.claude/kancalar/oturum-sonu.sh|yerel/pc/.claude/kancalar/oturum-sonu.sh
.claude/kancalar/sunucu.sh|yerel/pc/.claude/kancalar/sunucu.sh
.claude/kancalar/yerel-ates.sh|yerel/pc/.claude/kancalar/yerel-ates.sh
.claude/kancalar/yerel-servis.sh|yerel/pc/.claude/kancalar/yerel-servis.sh
.claude/kancalar/kod-guncelle.sh|yerel/pc/.claude/kancalar/kod-guncelle.sh"

UZAK_LISTE=$(printf '%s\n' "$ESLER" | cut -d'|' -f2 | tr '\n' ' ')
UZAK=$(ssh -n -T -o BatchMode=yes -o ConnectTimeout=8 "$SUNUCU" "cd $DEPO && md5sum $UZAK_LISTE 2>/dev/null; true" 2>/dev/null)
[ -n "$UZAK" ] || exit 2

FARK=""
while IFS='|' read -r YEREL DEPOYOL; do
  U=$(printf '%s\n' "$UZAK" | awk -v y="$DEPOYOL" '$2 == y {print $1}')
  [ -n "$U" ] || continue                                  # depoda yok: karşılaştırılmaz
  if [ -f "$KOK/$YEREL" ]; then
    Y=$(md5sum "$KOK/$YEREL" 2>/dev/null | cut -d' ' -f1)
    [ "$U" = "$Y" ] && continue
  else
    [ -d "$(dirname "$KOK/$YEREL")" ] || continue          # o parça bu PC'de kurulu değil (ör. servis)
  fi
  FARK="$FARK $YEREL"
done <<< "$ESLER"

if [ "${1:-}" = "--denetle" ]; then
  [ -z "$FARK" ] && exit 0
  printf '%s\n' $FARK
  exit 1
fi
[ -z "$FARK" ] && { echo "✓ PC hafıza kodu sunucudaki depoyla aynı"; exit 0; }

SERVIS=0; HATA=0
for YEREL in $FARK; do
  DEPOYOL=$(printf '%s\n' "$ESLER" | awk -F'|' -v y="$YEREL" '$1 == y {print $2}')
  if scp -q -o BatchMode=yes -o ConnectTimeout=8 "$SUNUCU:$DEPO/$DEPOYOL" "$KOK/$YEREL.yeni" 2>/dev/null \
     && mv -f "$KOK/$YEREL.yeni" "$KOK/$YEREL"; then
    echo "  ↓ $YEREL"
    case "$YEREL" in araclar/beyin/kod/beyin|araclar/beyin/kod/beyin-anlam) SERVIS=1 ;; esac
  else
    rm -f "$KOK/$YEREL.yeni"; echo "  ⚠️ alınamadı: $YEREL"; HATA=1
  fi
done

if [ "$SERVIS" = 1 ]; then
  # Servis `beyin` kodunu açılışta BİR KEZ modül olarak yükler → yeniden başlatılmalı.
  # Yalnız komut satırında beyin-anlam geçen pythonw süreci, PID'iyle durdurulur (geniş desenle öldürme yok).
  powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='pythonw.exe'\" | Where-Object { \$_.CommandLine -like '*kod*beyin-anlam*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
  for _ in 1 2 3 4 5 6 7 8 9 10; do                     # eski süreç adresi bıraksın (en çok ~5 sn)
    { exec 3<>/dev/tcp/127.0.0.1/7341; } 2>/dev/null || break
    exec 3>&-; sleep 0.5
  done
  bash "$KOK/.claude/kancalar/yerel-servis.sh" < /dev/null > /dev/null
  echo "  ↻ hafıza servisi yeniden başlatıldı (model ~2 sn'de yüklenir)"
fi
exit "$HATA"
