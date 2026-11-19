#!/usr/bin/env bash
# UserPromptSubmit kancası — NÖRON ATEŞLEMESİ.
#
# İnsan beyni "hangi anıyı hatırlamalıyım" diye aramaz; bağlam anıyı tetikler.
# Burada da öyle: kullanıcının cümlesi nöronların `tetik` etiketleriyle eşleşirse
# o kural/tuzak kendiliğinden bağlama girer. Eşleşme yoksa hiçbir şey enjekte
# edilmez (bedava).
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

GIRDI=$(cat)
# İlk 20.000 karakter yeter: 128 KB üstü istem (yapıştırılmış log) argv sınırını
# (MAX_ARG_STRLEN) aşıp execve'yi E2BIG ile patlatır; kanca sessizce ölür,
# nöron hiç ateşlenmez.
ISTEM=$(printf '%s' "$GIRDI" | python3 -c \
  'import json,sys; print(json.load(sys.stdin).get("prompt","")[:20000])' 2>/dev/null) || ISTEM=""
[ -z "$ISTEM" ] && exit 0

# BEYIN_KAYIT=1: yalnız gerçek istemler ateşleme kaydına yazılsın — ölçüm
# betikleri `beyin ates`i kayıtsız çağırır.
ATES=$(BEYIN_KAYIT=1 timeout 15 "$KOK/bin/beyin" ates "$ISTEM" 2>/dev/null) || exit 0
case "$ATES" in
  ""|*"ateşlenen nöron yok"*) exit 0 ;;
esac

python3 - "$ATES" <<'PY' 2>/dev/null || true
import json, sys
print(json.dumps({
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": (
      "⚡ Hafızadan bu isteğe otomatik gelenler (kural/tuzak nöronu = uy; "
      "📓 kayıt = geçmişten ilgili not, gerekirse `beyin ara`/`beyin is` ile aç; "
      "📎 konu kaynağı = gerekirse `beyin not <yol>` ile aç):\n\n" + sys.argv[1]
    )
  },
  "suppressOutput": True
}))
PY
