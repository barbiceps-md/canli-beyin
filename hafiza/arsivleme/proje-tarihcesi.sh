#!/usr/bin/env bash
# proje-tarihcesi — KATMAN 3: aylık PROJE TARİHÇESİ.
#
# NEDEN VAR: ileride sisteme bakacak birine "nasıl ilerledik"i göstermek için.
# Ham log bunun için okunmaz, günlük özetler ise çok parçalı. Bu betik ayda
# bir, o ayın günlüklerini + depoların gerçek git tarihçesini birleştirip TEK
# belge üretir: <arşiv>/proje-tarihcesi/YYYY-AA.md
#
# Bu belge dışarıya gösterilmek üzere yazılır: teknik ama okunur, iddiası
# commit'lerle desteklenir.
#
# Kullanım: proje-tarihcesi.sh [YYYY-AA]     (boşsa geçen ay)
# Ayar (ortam): BEYIN_DEPOLAR  tarihçesi okunacak git depoları, boşlukla ayrılır
#               BEYIN_PROJE    belgenin başlığındaki proje adı (varsayılan "Proje")
#               BEYIN_MODEL    `claude --model` değeri (boşsa varsayılan model)
set -uo pipefail
BEYIN="${BEYIN_KASA:-$HOME/beyin}"
ARSIV="${BEYIN_ARSIV:-$HOME/beyin-arsiv}"
FARK="${BEYIN_UTC_FARK:-3}"
PROJE="${BEYIN_PROJE:-Proje}"

AY="${1:-$(date -u -d "+$FARK hours -1 month" +%Y-%m)}"
BAS="$AY-01"
SON=$(date -d "$BAS +1 month" +%Y-%m-%d)
HEDEF_DIR="$ARSIV/proje-tarihcesi"
CIKTI="$HEDEF_DIR/${AY}.md"
LOG="$ARSIV/kayit/proje-tarihcesi.log"
VERI=$(mktemp); trap 'rm -f "$VERI"' EXIT

mkdir -p "$HEDEF_DIR" "$(dirname "$LOG")"
kayit() { echo "[$(date -u -d "+$FARK hours" '+%d.%m %H:%M')] $*" >> "$LOG"; }

DEPOLAR="${BEYIN_DEPOLAR:-} $BEYIN"

{
  echo "# Ham veri — $AY"
  echo
  echo "## Depoların o ayki commit tarihçesi"
  for d in $DEPOLAR; do
    [ -d "$d/.git" ] || continue
    N=$(git -C "$d" rev-list --count --since="$BAS" --until="$SON" HEAD 2>/dev/null || echo 0)
    echo
    echo "### $(basename "$d") — $N commit"
    git -C "$d" log --since="$BAS" --until="$SON" --date=short \
        --format='- %ad %s' 2>/dev/null | head -120
    echo "İstatistik:"
    git -C "$d" diff --shortstat \
        "$(git -C "$d" rev-list -n1 --before="$BAS" HEAD 2>/dev/null || echo HEAD)" \
        "$(git -C "$d" rev-list -n1 --before="$SON" HEAD 2>/dev/null || echo HEAD)" \
        2>/dev/null | sed 's/^/  /'
  done
  echo
  echo "## O ayın günlük çalışma özetleri"
  for f in "$BEYIN"/gunluk/"${AY}"-*-ozet.md; do
    [ -f "$f" ] || continue
    echo
    echo "### $(basename "$f" -ozet.md)"
    sed '/^---$/,/^---$/d' "$f"
  done
} > "$VERI"

BOYUT=$(wc -c < "$VERI")
if [ "$BOYUT" -lt 500 ]; then
  kayit "$AY: yeterli veri yok ($BOYUT bayt), tarihçe yazılmadı"; exit 0
fi
kayit "$AY: veri hazır ($BOYUT bayt), tarihçe yazılıyor"

ISTEM=$(cat <<EOF
Aşağıda $PROJE için $AY ayına ait ham veri var: depoların git commit
tarihçesi ve o ayın günlük çalışma özetleri.

Bundan **aylık proje tarihçesi** belgesi yaz. Bu belge ileride sisteme bakacak
PROFESYONEL BİR YAZILIMCIYA gösterilecek — ama teknik olmayan biri de okuyacak.

Yapı:
# $PROJE — $AY Proje Tarihçesi
## Özet
Ay boyunca ne inşa edildi, 5-8 cümle. Rakam ver (commit sayısı, çıkan özellik).
## İnşa edilenler
Konu konu: her başlıkta NE yapıldı, HANGİ depoda, NEDEN gerekti. Commit
mesajlarına dayandır. Bitmeyenleri "yarım kaldı" diye ayrı yaz.
## Mimari kararlar ve gerekçeleri
Ayın kalıcı teknik kararları ve NİYE öyle seçildiği. Bir yazılımcının en çok
işine yarayacak bölüm bu — ayrıntılı yaz.
## Yaşanan arızalar ve alınan dersler
Gerçekten olmuş olaylar, sebep ve kalıcı çözümüyle.
## Ay sonunda sistemin hâli
Neyin canlı, neyin yarım, neyin bilinen borç olduğu.

KURALLAR:
- Türkçe. Teknik terim kullan ama ilk geçtiğinde tek cümleyle açıkla.
- Her iddiayı ham veriye dayandır; veride OLMAYAN şeyi UYDURMA.
- Sır/parola/jeton yazma.
- Pazarlama dili kullanma; olduğu gibi anlat, yarım kalanı yarım de.
- Yalnızca belgeyi yaz, başka açıklama ekleme.

--- HAM VERİ ---
$(cat "$VERI")
EOF
)

MODEL=(); [ -n "${BEYIN_MODEL:-}" ] && MODEL=(--model "$BEYIN_MODEL")

if (env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \
    timeout 1800 claude -p "$ISTEM" \
      "${MODEL[@]+"${MODEL[@]}"}" \
      --allowedTools "Read" \
      --add-dir "$BEYIN" \
      < /dev/null > "$CIKTI.tmp" 2>>"$LOG") && [ -s "$CIKTI.tmp" ]; then
  mv "$CIKTI.tmp" "$CIKTI"
  kayit "✓ $AY tarihçesi yazıldı ($(wc -l < "$CIKTI") satır) → $CIKTI"
else
  rm -f "$CIKTI.tmp"
  kayit "🔴 $AY tarihçesi yazılamadı"
  exit 1
fi
