# Ateşleme isabeti ölçümü

    python3 test/isabet/olc.py                       # varsayılan: kume.tsv, kasa: $BEYIN_KASA
    KUME=benim-kumem.tsv python3 test/isabet/olc.py
    python3 test/isabet/olc.py /baska/bir/beyin      # başka sürümle karşılaştır

Çıkış kodu: isabet ve recall %100 değilse 1.

Buradaki `kume.tsv` yalnız `ornek/` altındaki uydurma nöronlar içindir
(regresyon takımı onu kum havuzunda koşar). Kendi kasan büyüdükçe kendi
kümeni yaz — ateşleme ayarının işe yarayıp yaramadığını başka türlü bilemezsin.

## Sütunlar

    cümle <TAB> ZORUNLU <TAB> KABUL EDİLEBİLİR

ZORUNLU kaçarsa hata (recall düşer). KABUL EDİLEBİLİR ne ödül ne ceza.
Bu ikisinin dışında ateşlenen her nöron GÜRÜLTÜ sayılır. Kümenin yarısı
hiçbir şey ateşlememesi gereken gündelik cümleler olsun.

⚠️ **Etiket bir yargıdır.** "Gürültü" denen ateşlemenin aslında yerinde olduğu
sık görülür. Yeni küme yazarken önce ateşlemeye bak, sonra etiketle — tersi değil.

⚠️ **Bir kümeye ayar yaptıysan o küme artık ölçmez.** Yeni rakam istiyorsan
yeni küme yaz: üzerinde ayar yapılan kümede %100 görünen ateşleme, taze kümede
%13–44'e düşebiliyor. Rapor edeceğin rakam hiç ayar yapmadığın kümeden gelsin.

⚠️ **Recall asla düşmemeli.** Bir güvenlik kuralını kaçırmak, gürültüden çok
daha pahalıdır.
