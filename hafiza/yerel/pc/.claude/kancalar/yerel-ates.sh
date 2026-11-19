#!/usr/bin/env bash
# UserPromptSubmit (PC, Beyin v4): önce BU bilgisayardaki hafıza
# servisine sor (araclar/beyin, 127.0.0.1:7341 — SSH yok). Servis yoksa, hazır
# değilse ya da cevap vermezse eski yol: sunucuya SSH (~1,4 sn).
# Servis kurulu değilse settings.json'da bunun yerine `sunucu.sh ates` kullanılabilir.
# Yalnız bash iç komutları: Git Bash'te her dış program (cat, base64, timeout,
# head) ~50 ms ekliyordu. Kanca girdisi tek satır JSON'dur; olduğu gibi gider.
# Servis cevabı: hazır kanca JSON'u · "YOK" (ilgili nöron yok) · "HATA …" (sunucuya düş).
IFS= read -r -d '' GIRDI
CEVAP=""
if { exec 3<>/dev/tcp/127.0.0.1/7341; } 2>/dev/null; then
  printf 'KANCAJ %s\n' "${GIRDI//$'\n'/ }" >&3
  IFS= read -r -t 8 CEVAP <&3
  exec 3>&-
fi
case "$CEVAP" in
  YOK) exit 0 ;;
  "{"*) printf '%s' "$CEVAP"; exit 0 ;;
esac
printf '%s' "$GIRDI" | bash "${BASH_SOURCE[0]%/*}/sunucu.sh" ates
