#!/usr/bin/env bash
# Yerel kanca → sunucudaki kanca köprüsü. Kanca JSON'u stdin'den SSH'ye akar,
# sunucunun cevabı olduğu gibi Claude'a döner. Tek hafıza: sunucu.
# Kullanım: sunucu.sh oturum-basi | ates
BURASI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$BURASI/ayar.sh" 2>/dev/null || { echo '{"systemMessage":"⚠️ beyin: .claude/kancalar/ayar.sh yok — yerel/kur.ps1 çalıştır"}'; exit 0; }

case "${1:-}" in
  oturum-basi) HEDEF="$UZAK_KOK/yerel/sunucu/oturum-basi-yerel.sh" ;;
  ates)        HEDEF="$UZAK_KOK/kancalar/kanca-ates.sh" ;;
  *) exit 0 ;;
esac

GIRDI=$(cat)
CIKTI=$(printf '%s' "$GIRDI" | ssh -T -o BatchMode=yes -o ConnectTimeout=8 "$SUNUCU" "${UZAK_ORTAM:-} $HEDEF" 2>/dev/null)
RC=$?
if [ $RC -ne 0 ] && [ -z "$CIKTI" ]; then
  case "$1" in
    oturum-basi)
      printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"⚠️ SUNUCUYA BAĞLANILAMADI — ortak hafıza bu oturuma YÜKLENMEDİ. Kullanıcıya söyle; hafızayla ilgili iş yapmadan önce bağlantıyı dene."},"systemMessage":"⚠️ Sunucuya bağlanılamadı, hafıza yüklenmedi"}' ;;
  esac
  exit 0
fi
printf '%s' "$CIKTI"
