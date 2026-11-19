#!/usr/bin/env bash
# İkinci bilgisayardaki Claude'un SessionStart kancası SSH ile bunu çağırır.
# Sunucudaki oturumla AYNI bağlam: kural dosyası + ölçülen durum + son 72 saat.
# Tek yazma yeri burası; o bilgisayarda en çok kasanın salt okunur aynası
# durur (anlam katmanı kuruluysa — yerel/pc/BEYIN-PC.md).
#
# Kural dosyası: BEYIN_KURAL (varsayılan ~/CLAUDE.md, yoksa ~/.claude/CLAUDE.md)
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../.." && pwd)"
cat > /dev/null 2>&1

KD="${BEYIN_KURAL:-$HOME/CLAUDE.md}"
[ -f "$KD" ] || KD="$HOME/.claude/CLAUDE.md"
KURAL=$(cat "$KD" 2>/dev/null || echo "(sunucuda kural dosyası bulunamadı)")
GIRIS=$(timeout 25 "$KOK/bin/beyin" giris 2>&1) || GIRIS="(beyin giris çalışmadı)"

python3 - "$KURAL" "$GIRIS" <<'PY' 2>/dev/null || echo '{}'
import json, sys
kural, giris = sys.argv[1], sys.argv[2]
print(json.dumps({
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": (
      "YEREL OTURUM — sunucuda DEĞİL, ikinci bilgisayardasın. "
      "Hafıza sunucuda ve ORTAK: aşağısı SSH ile sunucudan otomatik geldi. "
      "Sunucudaki `beyin …` komutlarını burada `bash .claude/kancalar/beyin.sh …` "
      "ile koş. Yerele özgü kurallar bu klasördeki CLAUDE.md'de.\n\n"
      "════ SUNUCUNUN KURAL DOSYASI ════\n" + kural +
      "\n\n════ HAFIZA ════\n" + giris
    )
  }
}))
PY
