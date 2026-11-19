# ayar.sh — bu bilgisayarın hangi sunucudaki hafızaya bağlanacağı.
# yerel/kur.ps1 bunu senin değerlerinle `ayar.sh` adıyla yazar; elle de
# kopyalayıp düzenleyebilirsin. Sır içermez (SSH anahtarı ~/.ssh'ta durur).

# ~/.ssh/config'teki Host kısayolu
SUNUCU=beyin-sunucu

# Sunucuda bu deponun klonlandığı yer
UZAK_KOK=/home/kullanici/canli-beyin/hafiza

# Sunucuda kasa varsayılan yerde (~/beyin) değilse: UZAK_ORTAM="BEYIN_KASA=/yol/kasa"
UZAK_ORTAM=""
