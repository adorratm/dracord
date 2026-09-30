# Ev PC YouTube resolve relay (Hetzner bot duvarini asmak icin)
#   powershell -ExecutionPolicy Bypass -File scripts/start-yt-relay.ps1
param(
  [int]$Port = 8791,
  [string]$Secret = $env:YTDLP_RELAY_SECRET,
  [string]$Cookies = (Join-Path (Split-Path $PSScriptRoot -Parent) 'youtube-cookies.txt')
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# winget sonrasi ayni shell PATH guncellenmemis olabilir
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
  [System.Environment]::GetEnvironmentVariable('Path', 'User')

function Find-YtDlp {
  $cmd = Get-Command yt-dlp -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $winget = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter 'yt-dlp.exe' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($winget) { return $winget }
  return $null
}

if (-not $Secret) {
  $Secret = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  Write-Host "YTDLP_RELAY_SECRET=$Secret"
  Write-Host 'Bunu sunucu .env dosyasina yapistir'
}

if (-not (Test-Path -LiteralPath $Cookies)) {
  Write-Error "Cookie yok: $Cookies - once export + encode script"
  exit 1
}

$ytDlp = Find-YtDlp
if (-not $ytDlp) {
  Write-Host 'yt-dlp bulunamadi. Kur: winget install yt-dlp.yt-dlp'
  exit 1
}
$env:YTDLP_PATH = $ytDlp

$env:YTDLP_RELAY_PORT = "$Port"
$env:YTDLP_RELAY_SECRET = $Secret
$env:YTDLP_COOKIES_FILE = $Cookies
$env:YTDLP_IMPERSONATE = '1'

Write-Host "yt-dlp: $ytDlp"
Write-Host "Relay :$Port"
Write-Host "Diger terminal: cloudflared tunnel --url http://127.0.0.1:$Port"
Write-Host "Sunucu .env:"
Write-Host "  YTDLP_RELAY_URL=https://....trycloudflare.com"
Write-Host "  YTDLP_RELAY_SECRET=$Secret"
node (Join-Path $PSScriptRoot 'yt-resolve-relay.mjs')
