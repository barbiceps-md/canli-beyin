#!/usr/bin/env bash
# kur.sh — Canlı Beyin'i (hafıza + canlı görünüm) bu makineye bağlar. Tekrar çalıştırmak güvenlidir.
#
# Ne yapar:
#   1) `beyin`, `durum`, `beyin-canli` komutlarını BEYIN_BIN'e bağlar (betikler bu depoda kalır)
#      Windows (Git Bash): bağ yerine küçük sarmalayıcı yazar; `python3` çalışmıyorsa ara katman ekler
#   2) Kasayı (veri klasörü) kurar: klasörler, sözleşme, beyaz liste .gitignore, git
#   3) Üç kancayı Claude Code ayarına (~/.claude/settings.json) ekler (eskisinin kopyası kalır)
#   4) Testleri koşar, gece işleri için cron satırlarını GÖSTERİR (kendisi kurmaz)
#
# Kullanım: ./kur.sh            kur
#           ./kur.sh --ornek    kasaya örnek kasayı (uydurma nöronlar + sayfalar) da kopyala
#           ./kur.sh --testsiz  sondaki test koşusunu atla
#
# Yerler ortam değişkeniyle değişir: BEYIN_KASA (varsayılan ~/beyin),
# BEYIN_BIN (~/.local/bin), CLAUDE_AYAR (~/.claude/settings.json).
set -uo pipefail
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
H="$KOK/hafiza"
BEYIN="${BEYIN_KASA:-$HOME/beyin}"
BIN="${BEYIN_BIN:-$HOME/.local/bin}"
AYAR="${CLAUDE_AYAR:-$HOME/.claude/settings.json}"
ORNEK=0; TESTSIZ=0
for a in "$@"; do
  case "$a" in
    --ornek) ORNEK=1 ;;
    --testsiz) TESTSIZ=1 ;;
    -h|--yardim) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "bilinmeyen seçenek: $a"; exit 2 ;;
  esac
done
WIN=0
case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) WIN=1 ;; esac

echo "Canlı Beyin kurulumu — kaynak: $KOK · kasa: $BEYIN$([ "$WIN" = 1 ] && echo ' · Windows (Git Bash)')"
mkdir -p "$BIN"
export PATH="$BIN:$PATH"

# 0) Bağımlılıklar
python_iyi() { "$@" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' >/dev/null 2>&1; }
if ! python_iyi python3; then
  if [ "$WIN" = 1 ]; then
    # Windows'ta `python3` çoğu zaman Mağaza kısayoludur ("Python bulunamadı"); gerçek Python'u bul
    GERCEK=""
    for aday in python "py -3"; do
      if python_iyi $aday; then GERCEK=$($aday -c 'import sys; print(sys.executable)' | tr -d '\r'); break; fi
    done
    [ -z "$GERCEK" ] && { echo "  🔴 Python 3.8+ bulunamadı — python.org'dan kur (\"Add to PATH\" işaretli), sonra yeniden dene"; exit 1; }
    GERCEK=$(cygpath -u "$GERCEK" 2>/dev/null || echo "$GERCEK")
    printf '#!/bin/sh\n# Windows: "python3" Mağaza kısayoluna gitmesin (kur.sh yazdı)\nexport PYTHONUTF8=1\nexec "%s" "$@"\n' "$GERCEK" > "$BIN/python3"
    chmod +x "$BIN/python3"
    echo "  ✓ python3 ara katmanı: $BIN/python3 → $GERCEK"
  else
    echo "  🔴 python3 (3.8+) yok — kurup yeniden dene"; exit 1
  fi
fi
EKSIK=""
for k in git timeout readlink; do command -v "$k" >/dev/null 2>&1 || EKSIK="$EKSIK $k"; done
if [ -n "$EKSIK" ]; then
  echo "  🔴 eksik komut:$EKSIK — kurup yeniden dene (Linux/WSL/Git Bash; macOS'ta GNU coreutils gerekir)"; exit 1
fi
for k in gpg zstd claude; do
  command -v "$k" >/dev/null 2>&1 || echo "  ⚠️ '$k' yok — çalışma arşivi (hafiza/arsivleme/) onsuz çalışmaz; hafızanın kendisi çalışır"
done

# 1) Komutlar
chmod +x "$H"/bin/* "$H"/kancalar/*.sh "$H"/arsivleme/*.sh "$H"/ek/*.sh "$H"/windows/*.sh \
         "$H"/yerel/sunucu/*.sh "$KOK"/test/*.sh 2>/dev/null
if [ "$WIN" = 1 ]; then
  # Git Bash'te `ln -s` dosyayı KOPYALAR (bağ değil): kopya depoyla birlikte güncellenmez.
  # Bu yüzden her komut depodaki betiği çağıran küçük bir sarmalayıcıdır.
  sarmala() {   # sarmala <ad> <çalıştırılacak satır>
    printf '#!/bin/sh\n# %s — kur.sh yazdı; asıl betik: %s\nexport PYTHONUTF8=1 PATH="$(dirname "$0"):$PATH"\nif [ -z "${BEYIN_ANLAM:-}" ]; then [ -f "${BEYIN_ANLAM_KOK:-$HOME/beyin-anlam}/durum/acik" ] && export BEYIN_ANLAM=1 || export BEYIN_ANLAM=0; fi\n%s "$@"\n' \
      "$1" "$KOK" "$2" > "$BIN/$1"
    chmod +x "$BIN/$1"
  }
  sarmala beyin       "exec python3 \"$H/bin/beyin\""
  sarmala durum       "exec bash \"$H/bin/durum\""
  sarmala beyin-canli "exec bash \"$H/bin/beyin-canli\""
else
  ln -sfn "$H/bin/beyin" "$BIN/beyin"
  ln -sfn "$H/bin/durum" "$BIN/durum"
  ln -sfn "$H/bin/beyin-canli" "$BIN/beyin-canli"
fi
echo "  ✓ komutlar: $BIN/beyin, $BIN/durum, $BIN/beyin-canli"
case ":${PATH#"$BIN:"}:" in *":$BIN:"*) ;; *) echo "  ⚠️ $BIN PATH'te olmayabilir — kabuk ayarına ekle: export PATH=\"$BIN:\$PATH\"" ;; esac

# 2) Kasa iskeleti
for d in kural ders is gunluk wiki arsiv; do mkdir -p "$BEYIN/$d"; done
if [ "$ORNEK" = "1" ]; then
  # Örnek kasanın tamamı (nöronlar kaynak sayfalarına `ayrinti=` ile bağlı; yalnız nöron kopyalamak kırık bağ bırakırdı).
  # -n: kasada aynı adlı dosya varsa ona DOKUNMA.
  cp -rn "$KOK/ornek/kasa/." "$BEYIN/"
  echo "  ✓ örnek kasa kopyalandı (uydurma notlar — kendi nöronlarını yazınca sil)"
fi
[ -f "$BEYIN/NORON.md" ] || cp "$H/NORON.md" "$BEYIN/"
[ -f "$BEYIN/konu.tsv" ] || printf '# tetikler (virgülle)\thedef dosya (kasaya göre)\taçıklama\n' > "$BEYIN/konu.tsv"
[ -f "$BEYIN/is/acik.md" ] || cat > "$BEYIN/is/acik.md" <<'EOF'
# Açık İşler

Tek liste. Satır ≤160 karakter; hikâye/ayrıntı `is/ayrinti.md`'ye (`### <no>`).
Kapanan satır SİLİNİR.

| # | İş | Kim | Durum | Tarih |
|---|---|---|---|---|
EOF
[ -f "$BEYIN/is/ayrinti.md" ] || printf '# Açık iş ayrıntıları\n' > "$BEYIN/is/ayrinti.md"
# Beyaz liste: kasaya yanlışlıkla düşen yabancı klasör sürümlenmesin.
[ -f "$BEYIN/.gitignore" ] || cat > "$BEYIN/.gitignore" <<'EOF'
# BEYAZ LİSTE — yalnız hafıza dosyaları sürümlenir.
/*
!/.gitignore
!/NORON.md
!/konu.tsv
!/durum-ek.sh
!/canli.json
!/kural/
!/ders/
!/is/
!/gunluk/
!/wiki/
!/arsiv/
EOF
if [ ! -d "$BEYIN/.git" ]; then
  git -C "$BEYIN" init -q && echo "  ✓ kasa git deposu oluşturuldu (uzak depo eklersen ÖZEL olsun)"
fi
echo "  ✓ kasa hazır: $BEYIN"

# 3) Kancalar
mkdir -p "$(dirname "$AYAR")"
if [ -f "$AYAR" ]; then
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$AYAR" 2>/dev/null; then
    echo "  🔴 $AYAR geçerli JSON değil — dokunulmadı. Düzeltip yeniden çalıştır."; exit 1
  fi
  cp "$AYAR" "$AYAR.beyin-oncesi" 2>/dev/null
fi
BASH_WIN=""; KANCA_WIN=""
if [ "$WIN" = 1 ]; then
  BASH_WIN=$(cygpath -w "$(command -v bash)")
  KANCA_WIN=$(cygpath -w "$H/windows/kanca.sh")
fi
python3 - "$AYAR" "$H" "$BEYIN" "$HOME/beyin" "$WIN" "$BASH_WIN" "$KANCA_WIN" "$BIN" <<'PY'
import json, sys, os
p, h, kasa, varsayilan, win, bash_win, kanca_win, bin_ = sys.argv[1:9]
d = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
d.setdefault("hooks", {})
if win == "1":
    # Windows: Claude Code kancayı doğrudan bash.exe ile çağırır; sarmalayıcı ortamı kurar.
    istenen = {
        "SessionStart":     ({"command": bash_win, "args": [kanca_win, "oturum-basi"]}, 40, "beyin: giriş + ölçülen durum"),
        "UserPromptSubmit": ({"command": bash_win, "args": [kanca_win, "ates"]},        20, "beyin: nöron ateşlemesi"),
        "Stop":             ({"command": bash_win, "args": [kanca_win, "oturum-sonu"]}, 30, "beyin: sürümleme + sağlık"),
    }
else:
    istenen = {
        "SessionStart":     ({"command": h + "/kancalar/kanca-oturum-basi.sh"}, 40, "beyin: giriş + ölçülen durum"),
        "UserPromptSubmit": ({"command": h + "/kancalar/kanca-ates.sh"},        20, "beyin: nöron ateşlemesi"),
        "Stop":             ({"command": h + "/kancalar/kanca-oturum-sonu.sh"}, 30, "beyin: sürümleme + sağlık"),
    }
kimlik = lambda k: (k.get("command"), tuple(k.get("args") or ()))
eklenen = []
for olay, (komut, sure, mesaj) in istenen.items():
    mevcut = d["hooks"].setdefault(olay, [])
    if any(kimlik(x) == kimlik(komut) for g in mevcut for x in g.get("hooks", [])):
        continue
    kanca = dict({"type": "command"}, **komut, timeout=sure, statusMessage=mesaj)
    if olay == "Stop":
        kanca["async"] = True
    mevcut.append({"hooks": [kanca]})
    eklenen.append(olay)
# Kasa varsayılan yerde değilse kancalar ve Claude'un kabuğu yerini bilsin
if os.path.realpath(kasa) != os.path.realpath(varsayilan):
    if d.setdefault("env", {}).get("BEYIN_KASA") != kasa:
        d["env"]["BEYIN_KASA"] = kasa
        eklenen.append("env.BEYIN_KASA")
if win == "1" and os.path.realpath(bin_) != os.path.realpath(os.path.expanduser("~/.local/bin")):
    if d.setdefault("env", {}).get("BEYIN_BIN") != bin_:
        d["env"]["BEYIN_BIN"] = bin_
        eklenen.append("env.BEYIN_BIN")
# ham transkriptlerin otomatik silinmesini kapat (arşivleme bize ait)
if d.get("cleanupPeriodDays", 30) < 365:
    d["cleanupPeriodDays"] = 3650
    eklenen.append("cleanupPeriodDays")
with open(p, "w", encoding="utf-8") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
print("  ✓ kanca/ayar:", ", ".join(eklenen) if eklenen else "zaten kurulu")
PY

# 4) Doğrula
if [ "$TESTSIZ" = "0" ]; then
  echo
  "$KOK/test/hafiza-testleri.sh" | tail -2
fi

cat <<EOF

KALAN ELLE ADIMLAR
  1. CLAUDE.md'ne hafıza bölümünü ekle:  ornek/CLAUDE-ornek.md
  2. İlk nöronunu yaz:  beyin yeni <id> > $BEYIN/kural/<id>.md   sonra  beyin saglik
  3. Canlı görünüm:  beyin-canli   (kasadan sayfayı üretir; yolu ekrana basar)
  4. (isteğe bağlı) gece çalışma arşivi için cron — 'crontab -e' ile ekle:
EOF
ONEK=""; [ "$BEYIN" != "$HOME/beyin" ] && ONEK="BEYIN_KASA=$BEYIN "
sed -e "s|BEYIN_KOK|${ONEK}$H|g" -e '/^#/d' -e '/^$/d' -e 's/^/       /' "$H/cron/ornek-crontab"
echo "     Arşiv parolası (bir kez):  head -c 32 /dev/urandom | base64 > ~/.beyin-arsiv-parola && chmod 600 ~/.beyin-arsiv-parola"
[ "$WIN" = 1 ] && echo "     Windows'ta cron yok: zamanlanmış görev örneği hafiza/windows/OKU.md'de."
exit 0
