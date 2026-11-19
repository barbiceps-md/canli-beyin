#!/usr/bin/env bash
# is-gunlugu — KATMAN 2: günün ÇALIŞMA HİKÂYESİ.
#
# NEDEN VAR: ham transkript "lazım olursa" arşividir, insan okumaz. Bu betik
# o günün transkriptlerinden 1 sayfalık anlatı üretir: ne istendi, ne yapıldı,
# ne değişti, ne öğrenildi. Çıktı <kasa>/gunluk/ altına düşer — oturum
# başında YÜKLENMEZ, `beyin ara` ile bulunur.
#
# Maliyet: günde 1 küçük `claude -p` koşusu (abonelik kotasından).
#
# Kullanım: is-gunlugu.sh [YYYY-AA-GG]     (boşsa dün)
# Ayar (ortam): BEYIN_KULLANICI  günlükte anılacak ad (varsayılan "kullanıcı")
#               BEYIN_MODEL      `claude --model` değeri (boşsa varsayılan model)
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
BEYIN="${BEYIN_KASA:-$HOME/beyin}"
ARSIV="${BEYIN_ARSIV:-$HOME/beyin-arsiv}"
FARK="${BEYIN_UTC_FARK:-3}"
KIM="${BEYIN_KULLANICI:-kullanıcı}"

TARIH="${1:-$(date -u -d "+$FARK hours -1 day" +%Y-%m-%d)}"
GUNLUK_DIR="$BEYIN/gunluk"
CIKTI="$GUNLUK_DIR/${TARIH}-ozet.md"
LOG="$ARSIV/kayit/is-gunlugu.log"
OZ=$(mktemp); trap 'rm -f "$OZ"' EXIT

mkdir -p "$GUNLUK_DIR" "$(dirname "$LOG")"
kayit() { echo "[$(date -u -d "+$FARK hours" '+%d.%m %H:%M')] $*" >> "$LOG"; }

if [ -f "$CIKTI" ]; then
  kayit "$TARIH özeti zaten var, atlandı"; exit 0
fi

"$KOK/bin/oturum-ozut.py" "$TARIH" > "$OZ" 2>/dev/null
SATIR=$(wc -l < "$OZ")
if [ "$SATIR" -lt 8 ]; then
  kayit "$TARIH: anlamlı oturum yok ($SATIR satır öz), günlük yazılmadı"; exit 0
fi
kayit "$TARIH: öz hazır ($(wc -c < "$OZ") bayt), anlatı yazılıyor"

ISTEM=$(cat <<EOF
Aşağıda $TARIH günü yapılan işlerin ham özü var (oturum transkriptlerinden
makine tarafından süzüldü).

Bundan **1 sayfalık Türkçe çalışma günlüğü** yaz. Bu günlük iki kişi için:
(1) $KIM — günlük dille okur;
(2) ileride koda bakacak bir yazılımcı — "bu iş neden böyle yapılmış" sorusunun
cevabını burada arayacak.

Şu başlıklarla yaz:
## Ne istendi
O gün ne istendiği, isteyenin kendi cümlelerine sadık kalarak, 3-6 madde.
## Ne yapıldı
Fiilen ne değişti — dosya/sistem adı vererek. Sonuçsuz kalan denemeleri de yaz.
## Neden böyle yapıldı
O günün KARARLARI ve gerekçeleri. Bir yazılımcının "niye?" sorusuna cevap
verecek kısım burası; en değerli bölüm bu, atlama.
## Öğrenilenler / tuzaklar
Yanılıp düzeltilen şeyler. Yoksa "yok" yaz.
## Açık kalanlar
Bitmeyen, karara bağlanan, ertelenen işler.

KURALLAR:
- Türkçe, sade, abartısız. "Muhtemelen" yerine özde ne yazıyorsa onu yaz.
- Özde OLMAYAN bir şeyi UYDURMA. Emin değilsen yazma.
- Sır (parola, anahtar, jeton) yazma; özde maskeliyse maskeli bırak.
- Saatleri yerel saatle (UTC+$FARK) ver — özdeki saatler UTC'dir.
- En fazla ~80 satır. Ayrıntı zaten ham arşivde duruyor.
- Yalnızca günlüğün kendisini yaz, başka açıklama ekleme.

--- HAM ÖZ ---
$(cat "$OZ")
EOF
)

MODEL=(); [ -n "${BEYIN_MODEL:-}" ] && MODEL=(--model "$BEYIN_MODEL")

# API anahtarı ortamdaysa çıkarılır: bu koşu abonelikten gitsin, faturaya değil.
if (env -u ANTHROPIC_API_KEY -u ANTHROPIC_AUTH_TOKEN \
    timeout 900 claude -p "$ISTEM" \
      "${MODEL[@]+"${MODEL[@]}"}" \
      --allowedTools "Read" \
      < /dev/null > "$CIKTI.tmp" 2>>"$LOG") && [ -s "$CIKTI.tmp" ]; then
  {
    echo "---"
    echo "tarih: $TARIH"
    echo "tur: is-gunlugu"
    echo "kaynak: oturum transkriptleri"
    echo "---"
    echo
    cat "$CIKTI.tmp"
  } > "$CIKTI"
  rm -f "$CIKTI.tmp"
  kayit "✓ $TARIH günlüğü yazıldı ($(wc -l < "$CIKTI") satır) → $CIKTI"
else
  rm -f "$CIKTI.tmp"
  kayit "🔴 $TARIH günlüğü yazılamadı (kota/zaman aşımı olabilir)"
  exit 1
fi
