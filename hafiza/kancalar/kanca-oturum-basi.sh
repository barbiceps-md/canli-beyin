#!/usr/bin/env bash
# SessionStart kancası — oturum başında ÖLÇÜLEN durum + SON 72 SAAT (günlükten,
# canlı) + kısa açık iş listesi bağlama enjekte edilir. Kurallar burada
# tekrarlanmaz: CLAUDE.md'yi Claude Code zaten yükler.
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
cat > /dev/null 2>&1   # stdin'i tüket (hook JSON'u)

CIKTI=$(timeout 25 "$KOK/bin/beyin" giris 2>&1) || CIKTI="(beyin giris çalışmadı)"

python3 - "$CIKTI" <<'PY' 2>/dev/null || echo '{}'
import json, sys
print(json.dumps({
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": (
      "Oturum başlangıcı — aşağısı hafızadan OTOMATİK yüklendi, tekrar okuma. "
      "Kurallar CLAUDE.md'de. Durum ölçülmüştür; 'son 72 saat' günlükten "
      "canlı üretildi (önceki oturumların notları). Açık iş ayrıntısı: beyin is <no>.\n\n" + sys.argv[1]
    )
  }
}))
PY
