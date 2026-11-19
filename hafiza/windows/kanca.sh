#!/usr/bin/env bash
# Windows (Git Bash) kanca sarmalayıcısı — tek bilgisayar, kasa bu makinede.
#
# Çekirdek kancalar (../kancalar/) Linux için yazıldı: `python3` komutu ve betiklerin
# doğrudan koşturulması bekleniyor. Windows'ta `python3` çoğu zaman Microsoft Mağazası
# kısayoludur ve çalışmaz; konsol da cp1254/cp850 kodlamasındadır. Bu sarmalayıcı
# ortamı kurar ve depodaki kancayı OLDUĞU GİBİ çağırır — çekirdek kod değişmez.
#
#   PATH başına BEYIN_BIN (kur.sh oraya `python3` ara katmanını ve `beyin` komutunu yazar)
#   PYTHONUTF8=1 · PYTHONIOENCODING=utf-8  (✓ ⚡ 🧭 gibi işaretler konsolda bozulmasın)
#   BEYIN_ANLAM: anlam servisi yalnız açık olduğu biliniyorsa sorulur. Windows'ta kapalı
#   bir porta bağlanma denemesi ~1,5 sn sürer; her istemde bunu ödememek için servis
#   kendi bayrak dosyasını yazar: $BEYIN_ANLAM_KOK/durum/acik (bkz. yerel/pc/BEYIN-PC.md).
#
# Kullanım (settings.json, kur.sh yazar):
#   "command": "<Git>\\usr\\bin\\bash.exe", "args": ["<depo>\\hafiza\\windows\\kanca.sh", "ates"]
#   olaylar: oturum-basi | ates | oturum-sonu
BURASI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
H="$(cd "$BURASI/.." && pwd)"                 # hafiza/
export PATH="${BEYIN_BIN:-$HOME/.local/bin}:/usr/bin:/mingw64/bin:$PATH"
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8 LC_ALL=C.UTF-8
ANLAM_KOK="${BEYIN_ANLAM_KOK:-$HOME/beyin-anlam}"
if [ -f "$ANLAM_KOK/durum/acik" ]; then export BEYIN_ANLAM="${BEYIN_ANLAM:-1}"; else export BEYIN_ANLAM="${BEYIN_ANLAM:-0}"; fi
export BEYIN_KASA="${BEYIN_KASA:-$HOME/beyin}" BEYIN_ARSIV="${BEYIN_ARSIV:-$HOME/beyin-arsiv}"

case "${1:-}" in
  ates)        exec bash "$H/kancalar/kanca-ates.sh" ;;
  oturum-sonu) exec bash "$H/kancalar/kanca-oturum-sonu.sh" ;;
  oturum-basi)
    # Çekirdeğin oturum başı çıktısı + "zaman" bloğu: şu an ve son oturumlar (Claude Code'un
    # kendi konuşma kayıtlarından ÖLÇÜLÜR — hafızaya yazılmasa da kayıt eksiksizdir).
    GIRDI=$(cat)
    [ -f "$ANLAM_KOK/baslat.sh" ] && (nohup bash "$ANLAM_KOK/baslat.sh" >/dev/null 2>&1 &)
    ZAMAN=""
    [ "${BEYIN_ZAMAN:-1}" = "1" ] && ZAMAN=$(printf '%s' "$GIRDI" | timeout 10 python3 "$H/ek/zaman.py" kanca-baslangic 2>/dev/null)
    GIRIS=$(timeout 25 python3 "$H/bin/beyin" giris 2>&1) || GIRIS="(beyin giris çalışmadı — elle koş: beyin giris)"
    python3 - "$ZAMAN" "$GIRIS" <<'PY' 2>/dev/null || echo '{}'
import json, sys
zaman, giris = sys.argv[1], sys.argv[2]
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": (
    (zaman + "\n\n---\n\n" if zaman else "") +
    "Oturum başlangıcı — aşağısı hafızadan OTOMATİK yüklendi, tekrar okuma. "
    "Kurallar CLAUDE.md'de. Durum ölçülmüştür; 'son 72 saat' günlükten canlı üretildi. "
    "Açık iş ayrıntısı: beyin is <no> · arama: beyin ara <kelime>.\n\n" + giris)}}))
PY
    ;;
  *) exit 0 ;;
esac
