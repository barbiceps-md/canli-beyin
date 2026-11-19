#!/usr/bin/env bash
# SessionStart (PC, Beyin v4): bu bilgisayardaki hafıza servisi
# (araclar/beyin/kod/beyin-anlam) çalışıyor mu? Çalışıyorsa kasa aynasını hemen
# eşitlet (oturum en taze hafızayla başlasın); çalışmıyorsa arka planda başlat.
# Ayrıca PC'deki kod kopyaları sunucudaki depodan kaydıysa oturuma TEK
# satır ⚠️ ekler (kod-guncelle.sh --denetle). Fark yoksa çıktı vermez.
# { …; } 2>/dev/null: bağlantı reddi uyarısı ekrana basılmasın (fd 3 kabukta açık kalır)
denetle() {
  local fark
  fark=$(bash "${BASH_SOURCE[0]%/*}/kod-guncelle.sh" --denetle 2>/dev/null | tr '\n' ' ')
  [ -n "$fark" ] || return 0
  printf '{"systemMessage":"⚠️ PC hafıza kodu sunucudaki depodan farklı","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"⚠️ PC hafıza kodu sunucudaki depodan farklı: %s— güncellemek için: bash .claude/kancalar/kod-guncelle.sh"}}\n' "$fark"
}
if { exec 3<>/dev/tcp/127.0.0.1/7341; } 2>/dev/null; then
  printf 'ESITLE\n' >&3
  IFS= read -r -t 3 _ <&3
  exec 3>&-
  denetle
  exit 0
fi
KOK="${BASH_SOURCE[0]%/*}/../../araclar/beyin"
PYW="$(cd "$KOK" && pwd -W)/venv/Scripts/pythonw.exe"
KOD="$(cd "$KOK" && pwd -W)/kod/beyin-anlam"
if [ -f "$PYW" ] && [ -f "$KOD" ]; then
  powershell.exe -NoProfile -WindowStyle Hidden -Command \
    "Start-Process -WindowStyle Hidden -FilePath '$PYW' -ArgumentList '\"$KOD\"'" >/dev/null 2>&1
fi
denetle
exit 0
