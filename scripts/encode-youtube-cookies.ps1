# youtube-cookies.txt → YTDLP_COOKIES_B64 satırı (sunucu .env için)
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts/encode-youtube-cookies.ps1
param(
  [string]$CookiesPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'youtube-cookies.txt'),
  [string]$OutPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'youtube-cookies.b64.env')
)

if (-not (Test-Path $CookiesPath)) {
  Write-Error "Cookie dosyası yok: $CookiesPath"
  exit 1
}

$bytes = [IO.File]::ReadAllBytes((Resolve-Path $CookiesPath))
$b64 = [Convert]::ToBase64String($bytes)
$line = "YTDLP_COOKIES_B64=$b64"
Set-Content -Path $OutPath -Value $line -Encoding ascii -NoNewline
Write-Host "OK → $OutPath"
Write-Host "Sunucu /opt/dracord/.env dosyasına bu satırı ekle, sonra music-bot recreate."
Write-Host "Uzunluk: $($b64.Length) karakter"
