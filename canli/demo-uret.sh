#!/usr/bin/env bash
# demo-uret.sh — GitHub Pages demosunu (docs/) örnek kasadan yeniden üretir.
#
# Yalnız UYDURMA örnek veri kullanır (ornek/kasa). Kasa geçici bir klasöre kopyalanır ve orada git
# deposu yapılır: oturum başı çıktısı (`beyin giris`) gerçek bir kurulumdaki gibi "son sürüm …" der.
#   bash canli/demo-uret.sh            → docs/index.html, docs/beyin.css, docs/beyin.js, docs/veri.js
set -euo pipefail
KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GECICI="$(mktemp -d)"
trap 'rm -rf "$GECICI"' EXIT
cp -r "$KOK/ornek/kasa" "$GECICI/kasa"
git -C "$GECICI/kasa" init -q
git -C "$GECICI/kasa" -c core.autocrlf=false add -A
git -C "$GECICI/kasa" -c core.autocrlf=false -c user.name=ornek -c user.email=ornek@localhost commit -q -m "örnek kasa"
PY=python3; command -v python3 >/dev/null 2>&1 && python3 -c 'pass' 2>/dev/null || PY=python
yol() { command -v cygpath >/dev/null 2>&1 && cygpath -w "$1" || echo "$1"; }   # Windows Python'a Windows yolu
# Demo bu makinenin hafızasından HİÇBİR şey okumasın: arşiv (ateşleme kaydı, tarihçe) ve oturum kayıtları boş klasör.
mkdir -p "$GECICI/arsiv" "$GECICI/oturumlar"
export BEYIN_ARSIV="$GECICI/arsiv" BEYIN_ATES_KAYIT="$GECICI/arsiv/beyin-ates.tsv" BEYIN_OTURUM_KOK="$GECICI/oturumlar"        BEYIN_DIS_KAYNAK="$GECICI/arsiv" BEYIN_ANLAM=0
unset BEYIN_AYNA BEYIN_KAYIT
BEYIN_UTC_FARK="${BEYIN_UTC_FARK:-3}" PYTHONUTF8=1 "$PY" "$(yol "$KOK/canli/uret.py")" "$(yol "$GECICI/kasa")" \
  --sayfa "$(yol "$KOK/docs")" --giris --kurallar "$(yol "$KOK/ornek/CLAUDE-ornek.md")"
