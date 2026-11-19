---
id: canli-veri-onay
tur: kural
guncelleme: 2026-01-15
gecerlilik: kalici
tetik: veritabanı, tabloyu sil, kayıt sil, toplu güncelleme, drop table, truncate, canlı veri
bag: onkosul=yedek-once-al,ayrinti=ev-sunucusu
---
# Canlı veride silme/toplu güncelleme: ÖNCE onay + yedek

ÖRNEK NÖRON — kendi kuralını yazınca sil.

Doğrusu: ne silineceğini/değişeceğini satır sayısıyla söyle, onay al, yedeği
al, sonra uygula. Geri alınabilir işte (yeni dosya, yeni dal) onay bekleme.

Yanlışı: "nasılsa küçük bir düzeltme" diye doğrudan `DELETE` / `UPDATE` koşmak.

**Neden:** canlı veride geri al tuşu yok; yanlış `WHERE` bütün tabloyu götürür.
**Kanıt:** (kendi yaşadığın olayı tarihiyle buraya yaz)
