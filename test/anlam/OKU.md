# Anlam katmanı ölçümü (v4)

Ölçüm kümeleri KENDİ kasana göre yazılır ve iş verisi içerdiği için depoya girmez;
betiğin yanındaki klasöre koy (`paket-*.tsv`, `genel.tsv`, `epizodik.tsv`, `guvenlik/*.tsv`).

| betik | ne ölçer |
|---|---|
| `kalibre3.py <kod> <model>…` | iki kademeli seçim: tam / hatırlatma / maliyet; eşik ızgarası AYAR'da, sonuç SINAV'da |
| `ates_olc.py <beyin> <küme>` | `beyin ates` çıktısını uçtan uca ölçer (eski/yeni aynı ölçü) |
| `uctan_uca.py` | çalışan servisin kanca girişinden (127.0.0.1:7341) aynı ölçüm |

Küme biçimi: `paket-*.tsv` → `<hedef nöron id> TAB <dogal|dolayli> TAB <kullanıcının ağzından cümle>`.
Nöron adına göre yarısı AYAR, yarısı SINAV kümesine düşer (md5 çift/tek).

⚠️ Ayar yapılan küme (AYAR) artık ölçmez; rapor edilen rakam SINAV kümesinden. Yeni ayar
yapılacaksa yeni küme yazılır.
