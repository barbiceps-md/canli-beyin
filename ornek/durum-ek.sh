# durum-ek.sh — işine özgü ölçümler. Bu dosyayı <kasa>/durum-ek.sh olarak
# kopyala ve düzenle; `durum` komutu onu kaynak olarak okur (çalıştırmaz).
#
# İki diziye ekleme yaparsın:
#   EK+=("Etiket   : değer")     → durum tablosuna satır
#   UYARI+=("🔴 ...")            → DİKKAT listesine
#
# İLKE: buraya yazdığın her şey ÖLÇÜM olsun. Elle yazılmış sayı bayatlar.
# Ölçüm alınamadıysa bunu AÇIKÇA söyle — sessiz "✓ uyarı yok" en tehlikeli yalan.
# Sır yazma: bağlantı bilgisi kendi yerinden okunsun.

# Örnek 1 — son yedeğin yaşı
# SON=$(ls -t "$HOME"/yedekler/*.gpg 2>/dev/null | head -1)
# if [ -z "$SON" ]; then
#   UYARI+=("🔴 hiç yedek yok")
# else
#   YAS=$(yas_saat "$SON")
#   EK+=("Yedek    : ${YAS} saat önce")
#   [ "$YAS" -gt 30 ] && UYARI+=("🔴 son yedek ${YAS} saat önce")
# fi

# Örnek 2 — bir servis ayakta mı
# systemctl is-active --quiet nginx || UYARI+=("🔴 nginx kapalı")
