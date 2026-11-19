---
id: pipefail-grep-q
tur: ders
guncelleme: 2026-01-15
gecerlilik: kalici
tetik: pipefail, grep -q, SIGPIPE, yanlış negatif
bag: ayrinti=git-ipuclari
---
# `set -o pipefail` altında `komut | grep -q` yanlış negatif üretir

ÖRNEK NÖRON — kendi dersini yazınca sil.

Doğrusu: çıktıyı önce değişkene al, sonra ara:
`CIKTI=$(komut); grep -q desen <<<"$CIKTI"`

**Neden:** `grep -q` eşleşmeyi bulunca erken çıkar; üretici SIGPIPE ile ölür
ve pipeline başarısız sayılır. Sinsi yanı: desen çıktının sonundaysa test
geçer, başındaysa kalır.
**Kanıt:** (kendi yaşadığın olayı tarihiyle buraya yaz)
