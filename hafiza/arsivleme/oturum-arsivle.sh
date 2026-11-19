#!/usr/bin/env bash
# oturum-arsivle — KATMAN 1: ham oturum kaydı arşivi.
#
# NEDEN VAR: Claude Code transkriptleri varsayılan olarak 30 günde otomatik
# siler; haftalarca çalışma kaydı bu yüzden KALICI OLARAK kaybolabilir.
# Artık silme bize ait: son 45 gün canlı kalır (resume/rewind çalışsın diye),
# eskisi aya göre şifreli arşive alınır ve ancak DOĞRULANDIKTAN sonra silinir.
#
# Maliyet: ~4 kat sıkışma → ~120 MB/ay, ~1,5 GB/yıl.
# Bağlam maliyeti: SIFIR — bu arşiv hiçbir oturumda yüklenmez, yalnız aranır.
#
# Kullanım: oturum-arsivle.sh            (ayda bir cron'dan)
#           oturum-arsivle.sh --kuru     (ne yapacağını yaz, yapma)
set -uo pipefail

# Ortam değişkenleriyle ezilebilir — testin gerçek veriyi silmemesi için
ARSIV="${BEYIN_ARSIV:-$HOME/beyin-arsiv}"
KAYNAK="${ARSIV_KAYNAK:-$HOME/.claude/projects}"
HEDEF="${ARSIV_HEDEF:-$ARSIV/oturum-kayitlari}"
# Parola dosyasını sen üretirsin (kur.sh nasıl olduğunu söyler); depoya ve
# kasaya GİRMEZ. Kaybedersen arşiv açılamaz.
PAROLA="${ARSIV_PAROLA:-$HOME/.beyin-arsiv-parola}"
CANLI_GUN="${ARSIV_CANLI_GUN:-45}"
LOG="${ARSIV_LOG:-$ARSIV/kayit/oturum-arsiv.log}"
FARK="${BEYIN_UTC_FARK:-3}"
KURU=0; [ "${1:-}" = "--kuru" ] && KURU=1

mkdir -p "$(dirname "$LOG")"
kayit() { echo "[$(date -u -d "+$FARK hours" '+%d.%m %H:%M')] $*" | tee -a "$LOG"; }

[ -s "$PAROLA" ] || { kayit "🔴 $PAROLA yok — şifresiz arşiv alınmaz, çıkılıyor"; exit 1; }
mkdir -p "$HEDEF"

# 45 günden eski transkriptleri aya göre grupla.
# `find -newermt` ile ay sınırı KULLANILMIYOR: mtime'ı tam olarak ayın 1'i
# 00:00:00 olan dosya "kesinlikle daha yeni" testine takılıp hiçbir aya
# düşmüyordu — sonsuza dek arşivlenmeden kalırdı.
# Onun yerine her dosyanın ayı tek geçişte kendisinden hesaplanır.
TMPD=$(mktemp -d); trap 'rm -rf "$TMPD"' EXIT
BULUNAN=0
while IFS= read -r d; do
  ay=$(date -d "@$(stat -c %Y "$d")" +%Y-%m)
  printf './%s\n' "${d#"$KAYNAK"/}" >> "$TMPD/$ay"
  BULUNAN=$((BULUNAN+1))
done < <(find "$KAYNAK" -name '*.jsonl' -mtime +"$CANLI_GUN" 2>/dev/null)

if [ "$BULUNAN" -eq 0 ]; then
  kayit "arşivlenecek dosya yok (her şey son $CANLI_GUN günde)"; exit 0
fi

for LISTE in "$TMPD"/*; do
  ay=$(basename "$LISTE")
  CIKTI="$HEDEF/oturum-${ay}.tar.zst.gpg"
  ADET=$(wc -l < "$LISTE")

  if [ -f "$CIKTI" ]; then
    kayit "$ay: arşiv zaten var, $ADET dosya ona EKLENMEZ — elle bak"; continue
  fi
  if [ "$KURU" = "1" ]; then
    kayit "[kuru] $ay: $ADET dosya → $(basename "$CIKTI")"; continue
  fi

  kayit "$ay: $ADET dosya arşivleniyor…"
  if tar -C "$KAYNAK" -cf - -T "$LISTE" \
       | zstd -19 -T0 -q \
       | gpg --batch --quiet --yes --symmetric --cipher-algo AES256 \
             --passphrase-file "$PAROLA" -o "$CIKTI"
  then
    # DOĞRULA: şifre çözülüp içindeki dosya sayısı tutuyor mu?
    ICERIK=$(gpg --batch --quiet --decrypt --passphrase-file "$PAROLA" "$CIKTI" 2>/dev/null \
             | zstd -dq 2>/dev/null | tar tf - 2>/dev/null | wc -l)
    if [ "$ICERIK" = "$ADET" ]; then
      BOYUT=$(du -h "$CIKTI" | cut -f1)
      kayit "✓ $ay doğrulandı ($ICERIK dosya, $BOYUT) → kaynaklar siliniyor"
      (cd "$KAYNAK" && tr '\n' '\0' < "$LISTE" | xargs -0 rm -f)
    else
      kayit "🔴 $ay DOĞRULAMA BAŞARISIZ (arşivde $ICERIK, beklenen $ADET) — kaynak SİLİNMEDİ"
      mv "$CIKTI" "$CIKTI.bozuk"
    fi
  else
    kayit "🔴 $ay arşivlenemedi — kaynak silinmedi"
    rm -f "$CIKTI"
  fi
done

kayit "arşiv turu bitti · toplam arşiv: $(du -sh "$HEDEF" 2>/dev/null | cut -f1)"
