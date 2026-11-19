---
id: python-degisken-varsayilan
tur: ders
guncelleme: 2026-10-02
gecerlilik: kalici
tetik: varsayılan argüman, mutable default, def f(x=[])
bag: ayrinti=python-notlari
---
# Fonksiyon varsayılanı olarak liste/sözlük verilmez

`def ekle(x, l=[])` her çağrıda AYNI listeyi kullanır.
Doğrusu: `l=None` ver, içeride `l = [] if l is None else l`.
