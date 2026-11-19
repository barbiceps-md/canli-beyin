#!/usr/bin/env bash
# Sunucudaki `beyin` komutu, yerelden. Örn: bash .claude/kancalar/beyin.sh ara <kelime>
#                                         bash .claude/kancalar/beyin.sh ekle "not metni"
BURASI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$BURASI/ayar.sh" || { echo "ayar.sh yok — yerel/kur.ps1 çalıştır"; exit 1; }
ARG=""; for a in "$@"; do ARG="$ARG $(printf '%q' "$a")"; done
exec ssh -n -T -o BatchMode=yes -o ConnectTimeout=8 "$SUNUCU" "${UZAK_ORTAM:-} $UZAK_KOK/bin/beyin$ARG"
