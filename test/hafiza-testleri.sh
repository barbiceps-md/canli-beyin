#!/usr/bin/env bash
# hafiza-testleri — hafıza çekirdeğinin regresyon takımı.
#
# Her test bir zamanlar gerçekten yaşanmış bir hatadan doğdu. Takım KENDİ kum
# havuzunu kurar (geçici klasörde örnek nöronlarla bir kasa); senin gerçek
# kasana, ayarına ve transkriptlerine DOKUNMAZ. Bir hata geri dönerse buradaki
# test kırmızı yanar.
#
# Kullanım: test/hafiza-testleri.sh         → tüm takım, özet + çıkış kodu
set -uo pipefail
export LC_ALL=C.UTF-8
# Eski testler ANLAM SERVİSİ OLMADAN koşar — sonuçları belirlenimci kalsın.
# Anlam yolunun kendi testleri bölüm 17'de.
export BEYIN_ANLAM=0
KOK="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"

D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT
export BEYIN_KASA="$D/kasa" BEYIN_ARSIV="$D/arsiv" BEYIN_OTURUM_KOK="$D/oturumlar"
unset BEYIN_DIS_KAYNAK BEYIN_AYNA BEYIN_KAYIT
# Testler canlı kancayı da çağırır: ateşleme kaydı kum havuzuna yazılsın.
export BEYIN_ATES_KAYIT="$D/ates-kayit.tsv"
FARK="${BEYIN_UTC_FARK:-3}"
H="$KOK/hafiza"; B="$H/bin/beyin"; V="$BEYIN_KASA"
BUGUN=$(date -u -d "+$FARK hours" +%Y-%m-%d)

GECEN=0; KALAN=0
tut()  { GECEN=$((GECEN+1)); printf '  ✓ %s\n' "$1"; }
kir()  { KALAN=$((KALAN+1)); printf '  ✗ %s\n' "$1"; }
mesaj() { python3 -c 'import json,sys; print(json.load(sys.stdin).get("systemMessage",""))' 2>/dev/null; } # kanca JSON'undan düz metin
test_et() { # test_et "<ad>" <komut...>  → çıkış 0 = geçti
  local ad="$1"; shift
  if "$@" >/dev/null 2>&1; then tut "$ad"; else kir "$ad"; fi
}

# ── kum havuzu kur ──────────────────────────────────────────────────────────
# Kum havuzu = depodaki ÖRNEK KASANIN kopyası (uydurma nöronlar + konu sayfaları + konu.tsv).
# Örnek günlük notları tarihli olduğundan silinir (son72 testleri boş günlükle başlar); açık iş listesi test için sıfırlanır.
mkdir -p "$V"/{kural,ders,is,gunluk,wiki,arsiv} "$BEYIN_OTURUM_KOK"
cp -r "$KOK"/ornek/kasa/. "$V/"
rm -f "$V"/gunluk/*.md "$V/canli.json"
cp "$H/NORON.md" "$V/"
printf '# Açık İşler\n\n| # | İş | Kim | Durum | Tarih |\n|---|---|---|---|---|\n| 1 | Örnek iş | biz | bekliyor | 01.01 |\n' > "$V/is/acik.md"
printf '# Açık iş ayrıntıları\n' > "$V/is/ayrinti.md"

echo "── 0. Örnek küme: ateşleme isabeti (kum havuzu henüz temizken)"
if python3 "$KOK/test/isabet/olc.py" > "$D/isabet.txt" 2>&1; then
  tut "örnek kümede isabet ve recall %100"
else
  kir "örnek kümede isabet düştü: $(grep -E 'isabet|recall' "$D/isabet.txt" | tr -s ' ' | tr '\n' ' ')"
fi
test_et "örnek kasa sağlıklı (şema/kırık bağ/çift id yok)" "$B" saglik --cikis-kodu

echo "── 1. Bayat + yerine-gecti uyarıları"
printf -- '---\nid: t-bayat\ntur: ders\nguncelleme: 2026-01-01\ngecerlilik: 2026-02-01\ntetik: zumzumtest\nbag:\n---\n# Suresi dolmus\ngovde\n' > "$V/ders/t-bayat.md"
printf -- '---\nid: t-gecersiz\ntur: ders\nguncelleme: 2026-01-01\ngecerlilik: kalici\ntetik: zumzumtest\nbag: yerine-gecti=canli-veri-onay\n---\n# Gecersiz noron\nESKI YANLIS BILGI\n' > "$V/ders/t-gecersiz.md"
CIKTI=$("$B" ates "zumzumtest sorusu" 2>&1)
grep -q 'BAYAT' <<<"$CIKTI" && tut "bayat nöron ⚠️ ile geliyor" || kir "bayat uyarısı yok"
grep -q 'GEÇERSİZ' <<<"$CIKTI" && tut "yerine-gecti ⛔ GEÇERSİZ basıyor" || kir "yerine-gecti uyarısı yok"
grep -q 'ESKI YANLIS BILGI' <<<"$CIKTI" && kir "geçersiz nöronun gövdesi basılıyor" || tut "geçersiz nöronun gövdesi basılmıyor"
rm -f "$V/ders/t-bayat.md" "$V/ders/t-gecersiz.md"

echo "── 2. Türkçe-duyarsız arama"
printf -- '# Sayfa\n\n## Görseller\nfotoğraf çekimi İstanbul deposunda yapılır\n' > "$V/wiki/t-turkce.md"
A1=$("$B" ara fotograf 2>/dev/null | tail -1); A2=$("$B" ara fotoğraf 2>/dev/null | tail -1)
A3=$("$B" ara istanbul 2>/dev/null | tail -1);  A4=$("$B" ara İstanbul 2>/dev/null | tail -1)
[ "$A1" = "$A2" ] && grep -q 'basıldı' <<<"$A1" && tut "fotograf = fotoğraf $A1" || kir "fotograf($A1) ≠ fotoğraf($A2)"
[ "$A3" = "$A4" ] && grep -q 'basıldı' <<<"$A3" && tut "istanbul = İstanbul $A3" || kir "istanbul($A3) ≠ İstanbul($A4)"
rm -f "$V/wiki/t-turkce.md"

echo "── 3. Takvimde olmayan tarih çökertmiyor"
printf -- '---\nid: t-tarih\ntur: kural\nguncelleme: 2026-01-01\ngecerlilik: 2026-09-31\ntetik: ttarihtest\nbag:\n---\n# t\ng\n' > "$V/kural/t-tarih.md"
S3=$("$B" saglik 2>&1)
grep -q Traceback <<<"$S3" && kir "saglik çöküyor" || tut "saglik çökmüyor"
grep -q 'takvimde olmayan' <<<"$S3" && tut "saglik bozuk tarihi ADIYLA bildiriyor" || kir "bozuk tarih bildirilmiyor"
test_et "liste çökmüyor"   "$B" liste
test_et "ara çökmüyor"     "$B" ara ttarihtest
rm -f "$V/kural/t-tarih.md"

echo "── 4. Çift id tespiti"
printf -- '---\nid: t-cift\ntur: kural\nguncelleme: 2026-01-01\ngecerlilik: kalici\ntetik: ciftttest\nbag:\n---\n# a\ng\n' > "$V/kural/t-cift.md"
printf -- '---\nid: t-cift\ntur: ders\nguncelleme: 2026-01-01\ngecerlilik: kalici\ntetik: ciftttest\nbag:\n---\n# b\ng\n' > "$V/ders/t-cift.md"
S4=$("$B" saglik 2>&1)
grep -q 'Çift kayıt' <<<"$S4" && tut "çift id yakalanıyor" || kir "çift id sessiz geçiyor"
rm -f "$V/kural/t-cift.md" "$V/ders/t-cift.md"

echo "── 5. Backlink"
G5=$("$B" geri yedek-once-al 2>&1)
grep -q '←' <<<"$G5" && tut "türlü bağdan backlink bulunuyor" || kir "backlink bulunamıyor"
printf -- '# Eski sayfa\n\nbkz. [[yedek-once-al]]\n' > "$V/wiki/t-eski.md"
G5=$("$B" geri yedek-once-al 2>&1)
grep -q 't-eski.md' <<<"$G5" && tut "eski [[bağlantı]] biçimi bulunuyor (grep -F)" || kir "[[bağlantı]] araması çalışmıyor"
rm -f "$V/wiki/t-eski.md"

echo "── 6. gunluk/ ve is/ aranıyor"
printf '# G\n\n- [12:00] benzersizgunluknotu57\n' > "$V/gunluk/2026-01-01.md"
A6=$("$B" ara benzersizgunluknotu57 2>&1)
grep -q 'bulunamadı' <<<"$A6" && kir "günlük notu aramada çıkmıyor" || tut "günlük notu aranıyor"

echo "── 7. Dosya yolu ateşlemesi içeriği okuyor"
printf 'Bu dosyada zumzumtetik kelimesi geciyor.\n' > "$D/icerik-testi.txt"
printf -- '---\nid: t-icerik\ntur: ders\nguncelleme: 2026-01-01\ngecerlilik: kalici\ntetik: zumzumtetik\nbag:\n---\n# t\ng\n' > "$V/ders/t-icerik.md"
A7=$("$B" ates "$D/icerik-testi.txt" 2>&1)
grep -q 't-icerik' <<<"$A7" && tut "dosya içeriği bağlama katılıyor" || kir "dosya içeriği okunmuyor"
rm -f "$V/ders/t-icerik.md"

echo "── 8. Bölüm başlığı aranıyor"
printf -- '# Sayfa\n\n## benzersizbaslik42 hakkında\ngovde metni\n' > "$V/wiki/t-baslik.md"
A8=$("$B" ara benzersizbaslik42 2>&1)
grep -q 'bulunamadı' <<<"$A8" && kir "yalnız başlıkta geçen kelime bulunamıyor" || tut "başlıkta geçen kelime bulunuyor"
rm -f "$V/wiki/t-baslik.md"

echo "── 9. ekle: ilk-yazar başlık yarışı (dayanıklılık)"
GF="$V/gunluk/$BUGUN.md"; rm -f "$GF"
for i in $(seq 1 30); do "$B" ekle "yarış testi $i" >/dev/null 2>&1 & done; wait
BS=$(grep -c '^# Günlük' "$GF" || true); NS=$(grep -c 'yarış testi' "$GF" || true)
[ "$BS" = "1" ] && tut "başlık tek (30 paralel yazar)" || kir "başlık $BS kez yazıldı"
[ "$NS" = "30" ] && tut "30/30 not satırı korundu" || kir "not kaybı: $NS/30"

echo "── 10. BrokenPipe sessiz (kenar)"
"$B" liste 2>"$D/bp-err" | head -1 >/dev/null; grep -q Traceback "$D/bp-err" && kir "boru kapanınca traceback" || tut "boru kapanınca sessiz"

echo "── 11. Kancalar geçerli JSON (kanca hattı)"
J1=$(echo '{"prompt":"parolayı not dosyasına yazayım"}' | "$H/kancalar/kanca-ates.sh")
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert 'sir-dosyaya-yazilmaz' in d['hookSpecificOutput']['additionalContext']" "$J1" 2>/dev/null \
  && tut "ateş kancası JSON basıyor, doğru nöron içinde" || kir "ateş kancası bozuk/eksik JSON"
J2=$(python3 -c "import json; print(json.dumps({'prompt':'x'*200000}))" | "$H/kancalar/kanca-ates.sh"; echo OK)
grep -q OK <<<"$J2" && tut "200KB istem kancayı öldürmüyor" || kir "dev istem kancayı kırıyor"
echo 'BOZUK JSON' | "$H/kancalar/kanca-ates.sh" >/dev/null 2>&1 && tut "bozuk JSON'da sessiz çıkış" || kir "bozuk JSON'da hata"
J3=$(echo '{"prompt":"merhaba nasılsın"}' | "$H/kancalar/kanca-ates.sh")
[ -z "$J3" ] && tut "eşleşme yokken kanca hiçbir şey eklemiyor" || kir "eşleşme yokken çıktı var"
J4=$(echo '{}' | "$H/kancalar/kanca-oturum-basi.sh")
python3 -c "import json,sys; d=json.loads(sys.argv[1]); c=d['hookSpecificOutput']['additionalContext']; assert 'DURUM' in c and 'SON 72 SAAT' in c" "$J4" 2>/dev/null \
  && tut "oturum başı kancası durum + son 72 saat yüklüyor" || kir "oturum başı kancası eksik"

echo "── 12. durum: ölçüm + işe özgü ek + sessiz kalmama"
D12=$("$H/bin/durum" 2>&1)
grep -q 'DURUM' <<<"$D12" && grep -q 'nöron' <<<"$D12" && tut "durum tabloyu basıyor" || kir "durum tablo basmıyor"
printf 'EK+=("Deneme   : ek satır 4711")\nUYARI+=("🔴 deneme uyarısı 4712")\n' > "$V/durum-ek.sh"
D12=$("$H/bin/durum" 2>&1)
grep -q 'ek satır 4711' <<<"$D12" && grep -q 'deneme uyarısı 4712' <<<"$D12" && tut "durum-ek.sh satırı ve uyarısı tabloya giriyor" || kir "durum-ek.sh okunmuyor"
rm -f "$V/durum-ek.sh"
D12=$(BEYIN_KASA="$D/yok" "$H/bin/durum" 2>&1)
grep -q 'kasa klasörü yok' <<<"$D12" && tut "kasa yokken 🔴 uyarı basılıyor" || kir "kasa yokken sessiz"
D12=$("$H/bin/durum" kisa 2>&1)
[ "$(wc -l <<<"$D12")" = "1" ] && tut "durum kisa tek satır" || kir "durum kisa tek satır değil"

echo "── 13. Oturum sonu kancası: sürümleme"
if command -v git >/dev/null 2>&1; then
  git -C "$V" init -q 2>/dev/null
  printf '/*\n!/.gitignore\n!/NORON.md\n!/konu.tsv\n!/kural/\n!/ders/\n!/is/\n!/gunluk/\n!/wiki/\n!/arsiv/\n' > "$V/.gitignore"
  K13=$(echo '{}' | "$H/kancalar/kanca-oturum-sonu.sh" 2>/dev/null | mesaj)
  [ "$(git -C "$V" rev-list --count HEAD 2>/dev/null)" = "1" ] && grep -q 'sürümlendi' <<<"$K13" \
    && tut "değişiklik otomatik commit'lendi" || kir "oturum sonu kancası commit atmadı: $K13"
  "$B" ekle "ikinci not" >/dev/null 2>&1
  echo '{}' | "$H/kancalar/kanca-oturum-sonu.sh" >/dev/null 2>&1
  [ "$(git -C "$V" rev-list --count HEAD 2>/dev/null)" = "1" ] && tut "5 dk içinde ikinci commit atılmıyor (kısma)" || kir "kısma çalışmıyor"
  rm -f "$V/.git/beyin-commit-damgasi"; mkdir -p "$V/yabanci"; touch "$V/yabanci/x"
  echo '{}' | "$H/kancalar/kanca-oturum-sonu.sh" >/dev/null 2>&1
  git -C "$V" ls-files | grep -q '^yabanci/' && kir "beyaz liste dışı klasör sürümlendi" || tut "beyaz liste dışı klasör sürümlenmiyor"
  rm -rf "$V/yabanci"; rm -f "$V/.git/beyin-commit-damgasi" "$V/.gitignore"; "$B" ekle "üçüncü not" >/dev/null 2>&1
  K13=$(echo '{}' | "$H/kancalar/kanca-oturum-sonu.sh" 2>/dev/null | mesaj)
  grep -q 'SÜRÜMLENMEDİ' <<<"$K13" && tut ".gitignore yokken körlemesine sürümlemiyor, uyarıyor" || kir ".gitignore yokken uyarı yok"
else
  tut "(atlandı: git yok)"
fi

echo "── 14. Çalışma arşivi katmanları"
UTC_GUN=$(date -u +%Y-%m-%d)
mkdir -p "$BEYIN_OTURUM_KOK/-proje"
printf '{"type":"user","timestamp":"%sT10:00:00.000Z","message":{"role":"user","content":"raporu hazırla, parola: hunter2gizli"}}\n' "$UTC_GUN" > "$BEYIN_OTURUM_KOK/-proje/a.jsonl"
O14=$("$H/bin/oturum-ozut.py" "$UTC_GUN" 2>&1)
grep -q 'raporu hazırla' <<<"$O14" && tut "öz çıkarıcı kullanıcı isteğini alıyor" || kir "öz çıkarıcı isteği almadı"
grep -q 'hunter2gizli' <<<"$O14" && kir "öz çıkarıcı SIRRI SIZDIRIYOR" || tut "öz çıkarıcı sırrı maskeliyor"
test_et "öz çıkarıcı --istatistik" "$H/bin/oturum-ozut.py" "$UTC_GUN" --istatistik
if command -v gpg >/dev/null 2>&1 && command -v zstd >/dev/null 2>&1; then
  # arşivleyici kum havuzunda uçtan uca
  AD="$D/ars"; mkdir -p "$AD"/{k/-p,h}; echo '{}' > "$AD/k/-p/e.jsonl"; touch -d '2026-01-01' "$AD/k/-p/e.jsonl"
  echo 'kum-havuzu-parolasi' > "$AD/parola"
  ARSIV_KAYNAK="$AD/k" ARSIV_HEDEF="$AD/h" ARSIV_CANLI_GUN=1 ARSIV_LOG="$AD/log" ARSIV_PAROLA="$AD/parola" \
    "$H/arsivleme/oturum-arsivle.sh" >/dev/null 2>&1
  [ "$(ls "$AD/h"/*.gpg 2>/dev/null | wc -l)" = "1" ] && [ ! -f "$AD/k/-p/e.jsonl" ] \
    && tut "arşivleyici: şifreledi, doğruladı, kaynağı sildi" || kir "arşivleyici uçtan uca çalışmadı"
  echo '{}' > "$AD/k/-p/f.jsonl"; touch -d '2026-02-01' "$AD/k/-p/f.jsonl"
  ARSIV_KAYNAK="$AD/k" ARSIV_HEDEF="$AD/h" ARSIV_CANLI_GUN=1 ARSIV_LOG="$AD/log" ARSIV_PAROLA="$AD/yok" \
    "$H/arsivleme/oturum-arsivle.sh" >/dev/null 2>&1
  [ -f "$AD/k/-p/f.jsonl" ] && tut "arşivleyici: parola yokken şifresiz arşiv almıyor, kaynağı silmiyor" || kir "parola yokken kaynak silindi"
else
  tut "(atlandı: gpg/zstd yok — arşivleyici test edilmedi)"
fi

echo "── 15. v3: tavanlı arama, konu dizini, açık iş, son 72 saat"
{ echo '# Sık sayfa'; for i in $(seq 1 40); do printf '\n## Bölüm %s\nsikkelime burada geçiyor. %s\n' "$i" "$(head -c 400 /dev/zero | tr '\0' x)"; done; } > "$V/wiki/t-sik.md"
AB=$("$B" ara sikkelime 2>/dev/null | wc -c)
[ "$AB" -gt 500 ] && [ "$AB" -lt 40000 ] && tut "ara tavanlı ($AB B)" || kir "ara tavanı çalışmıyor ($AB B)"
A15=$("$B" ara sikkelime 2>/dev/null)
grep -q -- '--tum' <<<"$A15" && tut "ara kalanları --tum ile işaret ediyor" || kir "ara --tum ipucu yok"
AT=$("$B" ara sikkelime --tum 2>/dev/null | wc -c); [ "$AT" -gt "$AB" ] && tut "ara --tum tamamını basıyor" || kir "ara --tum çalışmıyor"
rm -f "$V/wiki/t-sik.md"
# konu geri düşüşü: nöron tutmayınca kaynak sayfa işareti
printf 'zorbakonu, zorba test\twiki/zorba-test.md\tZorba deneme sayfasi\n' >> "$V/konu.tsv"; printf '# Zorba\nicerik\n' > "$V/wiki/zorba-test.md"
KO=$("$B" ates "zorbakonu hakkında bak" 2>&1); grep -q 'konunun kaynağı' <<<"$KO" && grep -q 'zorba-test' <<<"$KO" && tut "nöron tutmayınca konu.tsv işaret bırakıyor" || kir "konu geri düşüşü çalışmıyor"
N15=$("$B" not wiki/zorba-test.md 2>&1)
grep -q 'icerik' <<<"$N15" && tut "not <yol> kaynak sayfayı açıyor" || kir "not <yol> çalışmıyor"
rm -f "$V/wiki/zorba-test.md"
S15=$("$B" saglik 2>&1)
grep -q 'zorba-test.md yok' <<<"$S15" && tut "saglik kırık konu hedefini görüyor" || kir "saglik konu hedefini denetlemiyor"
# is: kısa satır + ayrıntı
printf '| 999t | Test maddesi | biz | bekliyor | 05.09 |\n' >> "$V/is/acik.md"; printf '\n### 999t\n\nAyrinti metni zorba\n\n*biz · bekliyor · 05.09*\n' >> "$V/is/ayrinti.md"
I15=$("$B" is 999t 2>&1)
grep -q 'Ayrinti metni zorba' <<<"$I15" && tut "is <no> ayrıntıyı getiriyor" || kir "is <no> ayrıntı getirmiyor"
# saglik: uzun satır + kapanmış satır
printf '| 998t | %s | biz | kapandı | 05.09 |\n' "$(head -c 200 /dev/zero | tr '\0' x)" >> "$V/is/acik.md"
S=$("$B" saglik 2>&1); grep -q '998t: satır' <<<"$S" && tut "saglik 160+ karakterlik iş satırını görüyor" || kir "saglik uzun satırı görmüyor"
grep -q '998t: kapanmış' <<<"$S" && tut "saglik kapanmış satırı görüyor" || kir "saglik kapanmış satırı görmüyor"
# son72: bugünkü not özete giriyor, tavan aşılmıyor
"$B" ekle "zorba son72 deneme notu" >/dev/null 2>&1
S72=$("$B" son72 2>&1)
grep -q 'zorba son72 deneme' <<<"$S72" && tut "son72 bugünkü notu gösteriyor" || kir "son72 bugünkü notu göstermiyor"
S72B=$(wc -c <<<"$S72"); [ "$S72B" -lt 7000 ] && tut "son72 tavan altında ($S72B B)" || kir "son72 çok büyük ($S72B B)"
G=$("$B" giris 2>/dev/null); grep -q 'DURUM' <<<"$G" && grep -q 'SON 72 SAAT' <<<"$G" && grep -q 'Açık İşler' <<<"$G" && tut "giris: durum + son72 + açık iş" || kir "giris eksik parça basıyor"

echo "── 16. kur.sh: sahte ev klasöründe kurulum (gerçek ayara dokunmaz)"
EV="$D/ev"; mkdir -p "$EV/.claude"; echo '{"model":"deneme","hooks":{"Stop":[{"hooks":[{"type":"command","command":"/baska/kanca.sh"}]}]}}' > "$EV/.claude/settings.json"
HOME="$EV" BEYIN_KASA="$EV/kasam" BEYIN_BIN="$EV/bin" CLAUDE_AYAR="$EV/.claude/settings.json" "$KOK/kur.sh" --testsiz --ornek >/dev/null 2>&1
HOME="$EV" BEYIN_KASA="$EV/kasam" BEYIN_BIN="$EV/bin" CLAUDE_AYAR="$EV/.claude/settings.json" "$KOK/kur.sh" --testsiz >/dev/null 2>&1
python3 - "$EV/.claude/settings.json" "$EV/kasam" <<'PY' 2>/dev/null && tut "kancalar eklendi, mevcut ayar korundu, iki kez kurmak çoğaltmıyor" || kir "kur.sh ayarı yanlış yazdı"
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
k = [" ".join([h["command"]] + h.get("args", [])) for o in d["hooks"].values() for g in o for h in g["hooks"]]
assert d["model"] == "deneme" and "/baska/kanca.sh" in k
assert len(k) == 4 and len(set(k)) == 4, k
assert d["env"]["BEYIN_KASA"] == sys.argv[2] and d["cleanupPeriodDays"] >= 365
PY
[ -f "$EV/kasam/.gitignore" ] && [ -d "$EV/kasam/.git" ] && [ -f "$EV/kasam/kural/canli-veri-onay.md" ] && [ -f "$EV/kasam/is/acik.md" ] \
  && tut "kasa iskeleti + beyaz liste + git + örnek nöronlar" || kir "kasa iskeleti eksik"
[ -f "$EV/.claude/settings.json.beyin-oncesi" ] && tut "eski ayarın kopyası alındı" || kir "eski ayar yedeklenmedi"
K16=$(BEYIN_KASA="$EV/kasam" "$EV/bin/beyin" ates "veritabanından şu kaydı sil" 2>&1)
grep -q 'canli-veri-onay' <<<"$K16" && tut "bağlanan 'beyin' komutu kurulan kasadan ateşliyor" || kir "bağlanan komut çalışmıyor"

echo "── 17. v4 — anlam katmanı, ayna, kayıt, son72"
# 17a. tetik ön elemesi eşleşme kaybettirmiyor (ünsüz yumuşaması + kısaltma kuralı)
printf -- '---\nid: t-yumusak\ntur: kural\nguncelleme: 2026-10-24\ngecerlilik: kalici\ntetik: zorbayedek\nbag:\n---\n# t\ng\n' > "$V/kural/t-yumusak.md"
"$B" ates "zorbayedeği alalım mı" 2>&1 | grep -q 't-yumusak' && tut "ön eleme: yumuşamalı ek (zorbayedek→zorbayedeği) tutuyor" || kir "ön eleme yumuşamalı eşleşmeyi düşürdü"
printf -- '---\nid: t-kisalt\ntur: kural\nguncelleme: 2026-10-24\ngecerlilik: kalici\ntetik: ZRB\nbag:\n---\n# t\ng\n' > "$V/kural/t-kisalt.md"
"$B" ates "zrbler geldi mi" 2>&1 | grep -q 't-kisalt' && kir "kısaltma tetiği ekli kelimede tuttu" || tut "kısaltma tetiği ekli kelimede tutmuyor"
"$B" ates "zrb geldi mi" 2>&1 | grep -q 't-kisalt' && tut "kısaltma tetiği tam kelimede tutuyor" || kir "kısaltma tam kelimede tutmadı"
rm -f "$V/kural/t-yumusak.md" "$V/kural/t-kisalt.md"
# 17b. son72: not başındaki tarih/saat tekrarı atılır, rakamlar bozulmaz, kapanış notu öne alınır
GT="$V/gunluk/$BUGUN.md"
printf -- '- [08:00] 24.10 ~08:05 OTURUM KAPANIŞI zorbakapanis ozet\n' >> "$GT"
for i in $(seq 1 14); do printf -- '- [09:%02d] zorbadolgu notu %s\n' "$i" "$i" >> "$GT"; done
printf -- '- [10:00] 3.500 kayıt zorbasayi\n- [10:01] 12.500 TL zorbatutar\n' >> "$GT"
S72=$("$B" son72 2>/dev/null)
grep -q '\[08:00\] OTURUM KAPANIŞI zorbakapanis' <<<"$S72" && tut "son72: önek atıldı + kapanış notu (en eski olsa da) gösterildi" || kir "son72: kapanış önceliği/önek atma çalışmıyor"
grep -q '3.500 kayıt zorbasayi' <<<"$S72" && grep -q '12.500 TL zorbatutar' <<<"$S72" && tut "son72: '3.500' / '12.500 TL' tarih sanılıp kırpılmadı" || kir "son72: rakam tarih sanılıp kırpıldı"
# 17c. ayna salt okunur: yazma komutları reddedilir, çıkış 1
# (çıktı önce değişkene alınır: pipefail altında `beyin | grep` çıkış 1'i kırmızı sayardı)
AY=$(BEYIN_AYNA=1 "$B" ekle "zorba ayna yazma" 2>&1); AYK=$?
grep -q 'SALT OKUNUR' <<<"$AY" && [ "$AYK" -eq 1 ] && ! grep -qs 'zorba ayna yazma' "$V"/gunluk/*.md \
  && tut "ayna: beyin ekle reddediyor, kasaya yazmıyor" || kir "ayna: beyin ekle yazdı / çıkış $AYK"
AY=$(BEYIN_AYNA=1 "$B" yeni zorba-ayna-noron 2>&1); AYK=$?
grep -q 'SALT OKUNUR' <<<"$AY" && [ "$AYK" -eq 1 ] && ! grep -q '^id: zorba-ayna-noron' <<<"$AY" \
  && tut "ayna: beyin yeni şablon basmıyor" || kir "ayna: beyin yeni şablon bastı / çıkış $AYK"
"$B" yeni zorba-asil-noron 2>/dev/null | grep -q '^id: zorba-asil-noron' && tut "asıl kasada beyin yeni şablonu basıyor" || kir "asıl kasada beyin yeni şablon basmadı"
# 17d. ateşleme kaydı yalnız BEYIN_KAYIT=1 ile, istem metni yazılmadan
KY="$D/ates.tsv"
BEYIN_ATES_KAYIT="$KY" "$B" ates "veritabanından şu kaydı sil zorbagizli" >/dev/null 2>&1
[ ! -s "$KY" ] && tut "kayıt: BEYIN_KAYIT olmadan yazılmıyor (ölçüm betikleri kirletmez)" || kir "kayıt: BEYIN_KAYIT olmadan yazıldı"
BEYIN_KAYIT=1 BEYIN_ATES_KAYIT="$KY" "$B" ates "veritabanından şu kaydı sil zorbagizli" >/dev/null 2>&1
grep -q 'canli-veri-onay' "$KY" && tut "kayıt: ateşlenen nöron yazıldı" || kir "kayıt: satır yok"
grep -q 'zorbagizli' "$KY" && kir "kayıt: İSTEM METNİ kayda girdi" || tut "kayıt: istem metni kayda girmiyor"
# 17e. anlam servisi yok/ulaşılamıyorsa davranış BİREBİR eski yol
E1=$(BEYIN_ANLAM=0 "$B" ates "veritabanından şu kaydı sil" 2>&1)
E2=$(BEYIN_ANLAM=1 BEYIN_ANLAM_ADRES=tcp:127.0.0.1:9 "$B" ates "veritabanından şu kaydı sil" 2>&1)
[ "$E1" = "$E2" ] && [ -n "$E1" ] && tut "servis yokken çıktı birebir eski yol" || kir "servis yokken çıktı değişti"
# 17f. iki kademeli seçim (sahte servis cevabıyla): sert kural daima gövdeyle, 🧭 başlık, kısa mesaj kapısı
SEC=$(cd "$D" && python3 - "$B" <<'PYT'
import importlib.machinery, importlib.util, sys
l = importlib.machinery.SourceFileLoader("b", sys.argv[1]); s = importlib.util.spec_from_loader("b", l)
B = importlib.util.module_from_spec(s); l.exec_module(B)
h = B.noronlar()
g, _ = B.sozcuk_eslesmeleri(B.sadelestir("veritabanından şu kaydı sil hemen"), h)
an = {"sonuc": [["n:saat-yerel-soylenir", 0.95], ["n:pipefail-grep-q", 0.62]], "ist": {"n": [0.5, 0.05]}, "ozel": {}}
v, l_, _ = B.anlam_secimi(g, an, h, kelime=5)
gov = [n["id"] for _, _, n in v]; lst = [n["id"] for n in l_]
v2, l2, _ = B.anlam_secimi(g, an, h, kelime=2)
print("SERT" if "canli-veri-onay" in gov else "-", "ANLAM" if "saat-yerel-soylenir" in gov else "-",
      "LISTE" if "pipefail-grep-q" in lst else "-",
      "KAPI" if "saat-yerel-soylenir" not in [n["id"] for _, _, n in v2] and "canli-veri-onay" in [n["id"] for _, _, n in v2] else "-")
PYT
)
[ "$SEC" = "SERT ANLAM LISTE KAPI" ] && tut "iki kademe: sert kural gövdede · güçlü anlam gövdede · zayıf anlam 🧭'de · kısa mesajda yalnız tetik" || kir "iki kademe seçimi beklenmedik: $SEC"
# 17h. (16.11) anlam yalnız EKLER: tetik yolunun seçtiği her nöron gövdede ya da 🧭'de kalır,
#      anlamca düşük skor (z<0) onu DÜŞÜRMEZ; belirgin anlam isabeti üstüne eklenir
BIR=$(cd "$D" && python3 - "$B" <<'PYT'
import importlib.machinery, importlib.util, sys
l = importlib.machinery.SourceFileLoader("b", sys.argv[1]); s = importlib.util.spec_from_loader("b", l)
B = importlib.util.module_from_spec(s); l.exec_module(B)
h = B.noronlar()
m = "veritabanından şu kaydı sil hemen"
g, zy = B.sozcuk_eslesmeleri(B.sadelestir(m), h)
taban = [n["id"] for _, _, n in (B.eski_secim(g, zy) or ([], [], ""))[0]]
an = {"sonuc": [["n:saat-yerel-soylenir", 0.95]] + [["n:" + t, 0.30] for t in taban],
      "ist": {"n": [0.5, 0.05]}, "ozel": {}}
v, el, li, _ = B.birlesik_secim(g, zy, an, h, len(m.split()))
gorulen = {n["id"] for _, _, n in v} | {n["id"] for n in li} | {n["id"] for n in el}
print("TABAN" if taban and all(t in gorulen for t in taban) else "-",
      "EK" if "saat-yerel-soylenir" in [n["id"] for _, _, n in v] else "-")
PYT
)
[ "$BIR" = "TABAN EK" ] && tut "anlam yalnız ekler: tetik isabeti düşmüyor, güçlü anlam isabeti ekleniyor" || kir "birleşik seçim beklenmedik: $BIR"
# 17g. tetik eşleştirme hızlı (ön eleme): 'beyin ates' 0,5 sn altında (Windows'ta süreç açılışı ~0,2 sn pahalı: 1 sn).
#      Üç denemenin en iyisi ölçülür — makinedeki anlık yük tek ölçümü kırmızıya çevirmesin.
SINIR=500; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) SINIR=1000 ;; esac
EN=999999
for _ in 1 2 3; do
  T0=$(date +%s%N); "$B" ates "müşteriye mesaj at ve teslim tarihini söyle" >/dev/null 2>&1; T1=$(date +%s%N)
  MS=$(( (T1-T0)/1000000 )); [ "$MS" -lt "$EN" ] && EN=$MS
done
[ "$EN" -lt "$SINIR" ] && tut "ates hızlı ($EN ms, sınır $SINIR)" || kir "ates yavaş ($EN ms, sınır $SINIR)"

echo
echo "════ SONUÇ: $GECEN geçti · $KALAN kaldı ════"
[ "$KALAN" -eq 0 ]
