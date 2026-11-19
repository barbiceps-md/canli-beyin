#!/usr/bin/env bash
# Bütün testler: hafıza çekirdeği (bash, kendi kum havuzunda) + Canlı Beyin üreticisi (python unittest).
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
PY=python3; python3 -c 'pass' 2>/dev/null || PY=python
echo "═══ 1/2 hafıza çekirdeği"
bash "$KOK/test/hafiza-testleri.sh" | tail -3; R1=${PIPESTATUS[0]}
echo "═══ 2/2 Canlı Beyin üreticisi"
( cd "$KOK" && PYTHONUTF8=1 "$PY" -m unittest discover -s test -p "test_*.py" 2>&1 | tail -4 ); R2=${PIPESTATUS[0]}
[ "$R1" -eq 0 ] && [ "$R2" -eq 0 ] && echo "✓ hepsi geçti" || { echo "✗ kalan var (çekirdek: $R1, üretici: $R2)"; exit 1; }
