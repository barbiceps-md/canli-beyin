#!/usr/bin/env bash
# Stop kancası — beyni SÜRÜMLE ve sağlığını kontrol et.
#
# NEDEN VAR: "her oturum sonunda commit at" kuralı yazılıydı ama uygulanmıyordu;
# kasa günlerce commit'siz kaldı, iki oturum aynı dosyaya yazıp birbirini ezdi
# ve fark edilmedi. Kanıtlanmış ilke: tutan tek kural kancalı olan.
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
cat > /dev/null 2>&1

BEYIN="${BEYIN_KASA:-$HOME/beyin}"
MESAJ=""

cd "$BEYIN" 2>/dev/null || exit 0

if [ -d .git ]; then
  DAMGA=.git/beyin-commit-damgasi

  # BAYAT KİLİT: çöken bir git süreci .git/index.lock bırakırsa kanca her
  # seferinde commit deneyip SESSİZCE başarısız olur. Bu depodaki git işi
  # 1 sn'den kısa sürer — 15 dakikadan eski kilit, koşan git yoksa bayattır.
  KILIT=.git/index.lock
  if [ -f "$KILIT" ] && ! pgrep -x git >/dev/null 2>&1; then
    if [ "$(( $(date +%s) - $(stat -c %Y "$KILIT" 2>/dev/null || date +%s) ))" -ge 900 ]; then
      rm -f "$KILIT"
      MESAJ="beyin git kilidi bayattı, kaldırıldı"
    fi
  fi

  # Değişiklik varsa ve son otomatik commit'ten 5 dk geçtiyse sürümle
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    SIMDI=$(date +%s)
    SON=0; [ -f "$DAMGA" ] && SON=$(cat "$DAMGA" 2>/dev/null || echo 0)
    if [ $(( SIMDI - SON )) -ge 300 ]; then
      DEGISEN=$(git status --porcelain | wc -l)
      # `git add -A` kör bir komuttur: kasaya yanlışlıkla düşen binlerce
      # dosyalık yabancı bir klasörü de alır ve uzak depoya yollar. Kasada
      # beyaz liste .gitignore olmalı; o yoksa ya da tek seferde 300+ yeni
      # dosya geliyorsa körlemesine sürümleme — dur ve uyar.
      YENI_DOSYA=$(git status --porcelain --untracked-files=all | grep -c '^??')
      if [ ! -f .gitignore ] || [ "$YENI_DOSYA" -gt 300 ]; then
        MESAJ="${MESAJ:+$MESAJ · }⚠️ beyin SÜRÜMLENMEDİ: $YENI_DOSYA yeni dosya (ya da .gitignore yok) — kasaya yabancı klasör girmiş olabilir, elle bak: cd $BEYIN && git status"
      elif git add -A >/dev/null 2>&1 && \
         git -c user.name=beyin -c user.email=beyin@localhost \
             commit -q -m "otomatik: oturum sonu anlık görüntü ($DEGISEN dosya)" 2>/dev/null; then
        echo "$SIMDI" > "$DAMGA"
        MESAJ="${MESAJ:+$MESAJ · }beyin sürümlendi ($DEGISEN dosya)"
        # Kasanın uzak deposu varsa (ÖZEL depo olmalı) sessizce push edilir;
        # başarısızlık SESSİZ KALMAZ.
        if git remote get-url origin >/dev/null 2>&1; then
          if ! timeout 20 git push -q origin HEAD >/dev/null 2>&1; then
            MESAJ="$MESAJ · ⚠️ uzak depoya PUSH EDİLEMEDİ — elle bak: cd $BEYIN && git push"
          fi
        fi
      else
        # ⛔ Sessiz başarısızlık YASAK.
        MESAJ="${MESAJ:+$MESAJ · }⚠️ beyin SÜRÜMLENEMEDİ ($DEGISEN dosya bekliyor) — elle bak: cd $BEYIN && git status"
      fi
    fi
  fi
fi

# Ağır sorun varsa kullanıcıya tek satır uyarı. TEK saglik çağrısı: iki ayrı
# çağrı Stop kancasının süre bütçesini aşabilir; ayrıca zaman aşımı (124)
# "sorun var" sanılmamalı.
SAGLIK=$(timeout 12 "$KOK/bin/beyin" saglik 2>/dev/null); RC=$?
if [ "$RC" -eq 124 ]; then
  MESAJ="${MESAJ:+$MESAJ · }beyin sağlığı ölçülemedi (12 sn'de bitmedi — elle bak: beyin saglik)"
elif printf '%s' "$SAGLIK" | grep -q '🔴'; then
  OZET=$(printf '%s' "$SAGLIK" | grep -E '^(🔴|⚠️)' | head -3 | tr '\n' ' ')
  MESAJ="${MESAJ:+$MESAJ · }beyin sağlığı: ${OZET:-sorun var, 'beyin saglik' çalıştır}"
fi

[ -z "$MESAJ" ] && exit 0
python3 - "$MESAJ" <<'PY' 2>/dev/null || true
import json, sys
print(json.dumps({"systemMessage": "🧠 " + sys.argv[1], "suppressOutput": True}))
PY
