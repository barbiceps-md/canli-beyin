#!/usr/bin/env bash
# Stop kancası (yerel). 1) Bu oturumun konuşma kaydını sunucuya yükler: gece
# iş günlüğü (oturum-ozut.py, ~/.claude/projects/*/*.jsonl) onu da okur,
# ertesi gün "son 72 saat"te yerel konuşmalar da görünür. 2) Sunucudaki
# oturum sonu kancasını (beyin sürümleme + sağlık) çağırır.
BURASI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$BURASI/ayar.sh" 2>/dev/null || exit 0

GIRDI=$(cat)
alan() { printf '%s' "$GIRDI" | sed -n 's/.*"'"$1"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1; }
YOL=$(alan transcript_path | sed 's/\\\\/\\/g')
SID=$(alan session_id | tr -cd 'A-Za-z0-9-')
command -v cygpath >/dev/null 2>&1 && [ -n "$YOL" ] && YOL=$(cygpath -u "$YOL")
UYARI=""
if [ -n "$SID" ] && [ -f "$YOL" ]; then
  # Hedef sunucudaki ev klasörüne göredir; klasörü kur.ps1 oluşturur.
  scp -q -o BatchMode=yes -o ConnectTimeout=8 "$YOL" \
      "$SUNUCU:.claude/projects/-yerel-pc/$SID.jsonl" 2>/dev/null \
    || UYARI="konuşma kaydı sunucuya yüklenemedi"
fi
# Hafıza servisinin ateşleme kaydı (hangi nöron ne zaman geldi; istem metni YOK)
# sunucudaki ortak kayda eklenir — "hiç ateşlenmeyen nöron" ölçümü bu bilgisayarın
# oturumlarını da görsün. Yalnız başarılı eklemeden sonra yerel kayıt boşaltılır.
# Paralel oturumların Stop kancaları aynı dosyayı paylaşmasın: her çağrı kayıt dosyasını
# KENDİ adına taşır (.gonder.<oturum>.<pid>); mv atomik, ikinci kanca boş bulur.
# Yarıda kalmış eski parti (öldürülen kanca) 10 dk sonra sıraya geri katılır.
AK="$BURASI/../../araclar/beyin/durum/beyin-ates.tsv"
SIMDI=$(date +%s)          # (find kullanılmaz: kanca PATH'inde Windows'un find.exe'si önde olabilir)
for ESKI in "$AK.gonder" "$AK".gonder.*; do
  [ -f "$ESKI" ] || continue
  [ $(( SIMDI - $(date -r "$ESKI" +%s 2>/dev/null || echo "$SIMDI") )) -gt 600 ] || continue
  cat "$ESKI" >> "$AK" 2>/dev/null && rm -f "$ESKI"
done
GON="$AK.gonder.${SID:-x}.$$"
UZAK_KAYIT='K="${BEYIN_ATES_KAYIT:-${BEYIN_ARSIV:-$HOME/beyin-arsiv}/beyin-ates.tsv}"; mkdir -p "$(dirname "$K")" && cat >> "$K"'
if [ -s "$AK" ] && mv "$AK" "$GON" 2>/dev/null; then
  touch "$GON" 2>/dev/null   # mv eski saati korur; yoldaki parti başka kancaya "bayat" görünmesin
  if ssh -T -o BatchMode=yes -o ConnectTimeout=8 "$SUNUCU" "${UZAK_ORTAM:+export $UZAK_ORTAM;} $UZAK_KAYIT" < "$GON" 2>/dev/null; then
    rm -f "$GON"
  else
    cat "$GON" >> "$AK" 2>/dev/null && rm -f "$GON"
  fi
fi
CIKTI=$(printf '%s' "$GIRDI" | ssh -T -o BatchMode=yes -o ConnectTimeout=8 "$SUNUCU" \
        "${UZAK_ORTAM:-} $UZAK_KOK/kancalar/kanca-oturum-sonu.sh" 2>/dev/null) || UYARI="${UYARI:-sunucuya bağlanılamadı}"
if [ -n "$UYARI" ]; then
  printf '{"systemMessage":"⚠️ %s"}\n' "$UYARI"
else
  printf '%s' "$CIKTI"
fi
