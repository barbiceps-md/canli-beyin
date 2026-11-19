# Windows'ta tek bilgisayar kurulumu (Git Bash)

Hafıza çekirdeği Linux için yazıldı; Windows'ta **Git for Windows**'un getirdiği Git Bash ile
aynen çalışır. Bu klasördeki `kanca.sh` yalnız ortamı kurar (gerçek Python, UTF-8 konsol) ve
çekirdek kancaları değiştirmeden çağırır. Hafıza bir sunucuda duruyorsa bunun yerine
`hafiza/yerel/OKU.md`'deki SSH köprüsüne bak.

## Gerekenler

- [Git for Windows](https://git-scm.com/download/win) (Git Bash, `bash.exe`, `cygpath` onunla gelir)
- [Python 3.8+](https://www.python.org/downloads/) — kurarken **"Add python.exe to PATH"** işaretli olsun
- Claude Code

## Kurulum (5 dakika)

**Git Bash**'i aç (Başlat menüsü → "Git Bash") ve yaz:

```bash
git clone https://github.com/barbiceps-md/canli-beyin.git ~/canli-beyin
cd ~/canli-beyin
./kur.sh --ornek
```

`kur.sh` Windows'u kendisi tanır ve şunları yapar:

| Ne | Nerede |
|---|---|
| `python3` ara katmanı (Mağaza kısayolu yerine gerçek Python) | `~/.local/bin/python3` — yalnız `python3` çalışmıyorsa |
| `beyin`, `durum`, `beyin-canli` komutları (depodaki betiği çağıran küçük sarmalayıcılar) | `~/.local/bin/` |
| kasa | `~/beyin` |
| üç kanca — `bash.exe` + `hafiza\windows\kanca.sh <olay>` | `~/.claude/settings.json` (eskisi `.beyin-oncesi` olarak kalır) |

Sonra `~/.local/bin`'i PATH'e ekle ki komutlar her yerde çalışsın (Git Bash'te, bir kez):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

Yeni bir Claude Code oturumu aç: bağlamda "DURUM —" bloğu görünmeli. "veritabanından şu kaydı sil"
yaz — örnek kural kendiliğinden gelmeli.

## Kancaların neye benzediği

`kur.sh` bunu kendisi yazar; elle kurmak istersen (`<...>` yerine kendi yolların):

```json
"UserPromptSubmit": [{ "hooks": [{
  "type": "command",
  "command": "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  "args": ["C:\\...\\canli-beyin\\hafiza\\windows\\kanca.sh", "ates"],
  "timeout": 20
}]}]
```

Olaylar: `SessionStart` → `oturum-basi` · `UserPromptSubmit` → `ates` · `Stop` → `oturum-sonu` (async).
Oturum başında ayrıca **zaman bloğu** gelir: şu an ve son oturumlar (Claude Code'un kendi kayıtlarından,
`hafiza/ek/zaman.py`). İstemezsen ortamda `BEYIN_ZAMAN=0`.

## Anlam katmanı (isteğe bağlı)

Windows'ta kapalı bir porta bağlanmayı denemek ~1,5 sn sürer; bu yüzden sarmalayıcılar anlam servisine
yalnız servis **açık olduğunu bildirdiğinde** sorar: `$BEYIN_ANLAM_KOK/durum/acik` dosyası (varsayılan
`~/beyin-anlam/durum/acik`). Servis kurulumu: `hafiza/yerel/pc/BEYIN-PC.md`.

## Haftalık yedek (isteğe bağlı)

`hafiza/ek/haftalik-yedek.sh` kasanın sır taramalı temiz anlık görüntüsünü **özel** bir uzak depoya
gönderir (kurulum adımları betiğin başında). Windows'ta zamanlamak için **PowerShell**'de (yolu kendi
klonunla değiştir):

```powershell
$e = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" -Argument '-lc "~/canli-beyin/hafiza/ek/haftalik-yedek.sh"'
$t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 21:00
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "Beyin haftalik yedek" -Action $e -Trigger $t -Settings $s
```

## Bilinen sınırlar

- Gece çalışma arşivi (`hafiza/arsivleme/`) `cron`, `gpg`, `zstd` ister; Windows'ta varsayılan olarak yok.
  Hafızanın kendisi (ateşleme, giriş, sürümleme) onsuz çalışır.
- `beyin ates` Windows'ta süreç açılışı yüzünden Linux'tan ~0,2 sn yavaştır (ölçüm: ~0,25 sn).
