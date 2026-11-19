# Güvenlik

## Açık bildirimi

Bir güvenlik açığı bulduysan lütfen **herkese açık bir issue açma**. GitHub'da bu deponun
**Security → Report a vulnerability** (özel bildirim) yolunu kullan. Ne bulduğunu, nasıl tekrarlanacağını ve
etkisini yaz; birkaç gün içinde dönüş yapılır.

## Kapsam

- `canli/` — sayfa: veri (`veri.js`) içindeki not metni sayfaya kaçışlanarak basılır. Kaçışsız HTML'e, `style`'a
  ya da bir bağlantının `href`'ine ulaşan her yol bir açıktır.
- `canli/uret.py` — maskeleme: sır kalıplarının (API anahtarı, jeton, parola ataması, parolalı bağlantı adresi,
  özel anahtar) sayfaya taşınması.
- `hafiza/` — kancalar ve araçlar: kasanın dışına yazma, istem metninin ateşleme kaydına girmesi, oturum
  özütünde sır sızması, beyaz liste dışı dosyaların sürümlenmesi.

## Kullanıcıya hatırlatma

- Kendi kasandan ürettiğin `veri.js` notlarının **tam metnini** içerir; herkese açık bir yere koyma.
- Kasanın uzak deposu (yedek) **özel** olmalı.
- Sır (parola, jeton, anahtar) hiçbir nörona, nota, günlüğe yazılmaz; yazıldıysa maskeleme son savunma hattıdır,
  ilk değil.
