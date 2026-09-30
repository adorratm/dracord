# Ev PC YouTube resolve relay — Hetzner bot duvarını aşmak için
#   powershell -ExecutionPolicy Bypass -File scripts/start-yt-relay.ps1
param(
  [int]$Port = 8791,
  [string]$Secret = $env:YTDLP_RELAY_SECRET,
  [string]$Cookies = (Join-Path (Split-Path $PSScriptRoot -Parent) 'youtube-cookies.txt')
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (-not $Secret) {
  $Secret = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  Write-Host "YTDLP_RELAY_SECRET=$Secret"
  Write-Host "(bunu sunucu .env'e yapıştır)"
}

if (-not (Test-Path $Cookies)) {
  Write-Error "Cookie yok: $Cookies — önce export + encode script"
  exit 1
}

if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  Write-Host 'yt-dlp bulunamadı. Kur: winget install yt-dlp.yt-dlp'
  exit 1
}

$env:YTDLP_RELAY_PORT = "$Port"
$env:YTDLP_RELAY_SECRET = $Secret
$env:YTDLP_COOKIES_FILE = $Cookies
$env:YTDLP_IMPERSONATE = '1'

Write-Host "Relay :$Port — ayrı terminalde: cloudflared tunnel --url http://127.0.0.1:$Port"
Write-Host "Sonra sunucu: YTDLP_RELAY_URL=https://....trycloudflare.com  YTDLP_RELAY_SECRET=$Secret"
node (Join-Path $PSScriptRoot 'yt-resolve-relay.mjs')
