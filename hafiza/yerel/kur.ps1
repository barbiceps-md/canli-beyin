# Ikinci bilgisayar (Windows) kurulumu: hafiza sunucuda kalir, bu bilgisayar
# ona SSH ile baglanir.
#
# Ne yapar: 1) SSH kisayolunu ekler  2) sunucu baglantisini dener
#           3) calisma klasorunu kurar (CLAUDE.md + kopru kancalari + ayar.sh)
# Tekrar calistirmak guvenlidir; kancalari gunceller, mevcut CLAUDE.md'ye dokunmaz.
#
# Ornek:
#   .\hafiza\yerel\kur.ps1 -Sunucu 203.0.113.10 -Kullanici ali -UzakKok /home/ali/canli-beyin/hafiza
#   ... -Anlam   anlam katmani klasorlerini kurar + kodu kopyalar (yerel/pc/BEYIN-PC.md)
#
# On kosul: bu bilgisayarin SSH acik anahtari sunucuda yetkili olmali
#           (ssh-keygen + ssh-copy-id ya da authorized_keys).
param(
  [Parameter(Mandatory = $true)][string]$Sunucu,
  [Parameter(Mandatory = $true)][string]$Kullanici,
  [Parameter(Mandatory = $true)][string]$UzakKok,
  [string]$Kisayol = "beyin-sunucu",
  [string]$Alan = (Join-Path $HOME "calisma"),
  [string]$UzakOrtam = "",
  [switch]$Anlam
)
$ErrorActionPreference = "Continue"
$SshDir = Join-Path $HOME ".ssh"
$Config = Join-Path $SshDir "config"
$Kaynak = Join-Path $PSScriptRoot "pc"
$Utf8   = New-Object Text.UTF8Encoding $false

Write-Host "`n[1/4] SSH kisayolu '$Kisayol'" -ForegroundColor Cyan
New-Item -ItemType Directory -Force $SshDir | Out-Null
$desen = '^\s*Host\s+' + [regex]::Escape($Kisayol) + '\s*$'
$var = (Test-Path $Config) -and (Select-String -Path $Config -Pattern $desen -Quiet)
if (-not $var) {
  $blok = "`nHost $Kisayol`n    HostName $Sunucu`n    User $Kullanici`n    ServerAliveInterval 30`n    ConnectTimeout 8`n"
  [IO.File]::AppendAllText($Config, $blok, $Utf8)
  Write-Host "    eklendi"
} else { Write-Host "    zaten var" }

Write-Host "[2/4] Sunucu baglantisi" -ForegroundColor Cyan
# -n sart: Windows ssh.exe PowerShell icinden stdin'i bekleyip hic kapanmayabiliyor
$sonuc = & ssh -n -o BatchMode=yes -o StrictHostKeyChecking=accept-new $Kisayol "mkdir -p .claude/projects/-yerel-pc && test -x '$UzakKok/bin/beyin' && echo tamam"
if ("$sonuc" -notmatch "tamam") {
  Write-Host "    BAGLANAMADI ya da $UzakKok/bin/beyin yok: $sonuc" -ForegroundColor Red
  Write-Host "    Sunucuda once depoyu klonlayip ./kur.sh calistirin." -ForegroundColor Red
  exit 1
}
Write-Host "    tamam"

Write-Host "[3/4] Git Bash kontrolu" -ForegroundColor Cyan
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host "    Git yok - kuruluyor"
  winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
} else { Write-Host "    var" }

Write-Host "[4/4] Calisma klasoru: $Alan" -ForegroundColor Cyan
$Kanca = Join-Path $Alan ".claude\kancalar"
New-Item -ItemType Directory -Force $Kanca | Out-Null
Copy-Item -Force (Join-Path $Kaynak ".claude\kancalar\*.sh") $Kanca
$AyarJson = Join-Path $Alan ".claude\settings.json"
if (Test-Path $AyarJson) {
  Write-Host "    .claude\settings.json zaten var - dokunulmadi; kancalari elle birlestirin: $Kaynak\.claude\settings.json" -ForegroundColor Yellow
} else { Copy-Item (Join-Path $Kaynak ".claude\settings.json") $AyarJson }
$Md = Join-Path $Alan "CLAUDE.md"
if (-not (Test-Path $Md)) { Copy-Item (Join-Path $Kaynak "CLAUDE.md") $Md }
$ayar = "SUNUCU=$Kisayol`nUZAK_KOK=$UzakKok`nUZAK_ORTAM=`"$UzakOrtam`"`n"
[IO.File]::WriteAllText((Join-Path $Kanca "ayar.sh"), $ayar, $Utf8)
Write-Host "    tamam"

if ($Anlam) {
  Write-Host "[+] Anlam katmani: araclar\beyin" -ForegroundColor Cyan
  $Depo = Split-Path $PSScriptRoot -Parent
  $AB = Join-Path $Alan "araclar\beyin"
  foreach ($k in "kod", "durum", "kasa") { New-Item -ItemType Directory -Force (Join-Path $AB $k) | Out-Null }
  Copy-Item -Force (Join-Path $Depo "bin\beyin"), (Join-Path $Depo "bin\beyin-anlam") (Join-Path $AB "kod")
  Copy-Item -Force (Join-Path $Kaynak "araclar-beyin\esitle.py") (Join-Path $AB "kod")
  Write-Host "    kod kopyalandi. Python ortami ve model icin: yerel\pc\BEYIN-PC.md > Kurulum"
}

Write-Host "`nKURULUM BITTI. Claude'u bu klasorden acin:" -ForegroundColor Green
Write-Host "    cd $Alan"
Write-Host "    claude`n"
