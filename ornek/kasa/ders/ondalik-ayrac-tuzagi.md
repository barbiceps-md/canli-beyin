---
id: ondalik-ayrac-tuzagi
tur: ders
guncelleme: 2026-01-15
gecerlilik: kalici
tetik: fiyat filtresi, is_numeric, binlik ayraç, tutar okuma, ondalık ayraç
bag: ayrinti=python-notlari
---
# Türkçe yazılmış "18.500" çoğu dilde **18,5** okunur — tutarı düz `float` ile okuma

ÖRNEK NÖRON — kendi dersini yazınca sil.

Doğrusu: kullanıcıdan gelen tutarı önce binlik noktalarından arındır, virgülü
noktaya çevir, sonra sayıya dönüştür. Bunu tek bir yardımcı işlevde yap.

**Neden:** nokta ondalık ayracı sayılır. "18.500" geçerli sayıdır ve 18,5 olur;
"1.278.130" ise sayı sayılmaz ve filtre sessizce yok sayılır — hata vermez,
yanlış sonuç verir.
**Kanıt:** (kendi yaşadığın olayı tarihiyle buraya yaz)
